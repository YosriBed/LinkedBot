import {
  getUpdates,
  answerCallback,
  notify,
  type TelegramUpdate,
} from "./clients/telegram.js";
import { publishPost } from "./clients/linkedin.js";
import { parseIdeas, markIdea, type Idea } from "./utils/ideas.js";
import { generateAndSend } from "./generate.js";
import {
  readJson,
  writeJson,
  type PendingDrafts,
  type PublishedPost,
} from "./utils/state.js";

const IDEAS_PATH = "content/ideas.md";
const PENDING_PATH = "content/pending-drafts.json";
const PUBLISHED_PATH = "content/published.json";
const OFFSET_PATH = "content/last-update-id.json";

const MAX_REGENS_PER_IDEA = 3;

interface OffsetFile {
  last_id: number;
}

async function main() {
  const offsetFile = await readJson<OffsetFile>(OFFSET_PATH, { last_id: 0 });
  const updates = await getUpdates(offsetFile.last_id + 1);

  if (updates.length === 0) {
    console.log("No new Telegram updates.");
    return;
  }

  console.log(`Processing ${updates.length} Telegram update(s)...`);

  let maxId = offsetFile.last_id;

  for (const update of updates) {
    try {
      const pending = await readJson<PendingDrafts>(PENDING_PATH, {});
      const published = await readJson<PublishedPost[]>(PUBLISHED_PATH, []);
      const updated = await handleUpdate(update, pending, published);
      if (updated.pendingDirty) await writeJson(PENDING_PATH, pending);
      if (updated.publishedDirty) await writeJson(PUBLISHED_PATH, published);
      maxId = Math.max(maxId, update.update_id); // seulement si tout s'est bien passé
    } catch (err) {
      console.error(`Failed to handle update ${update.update_id}:`, err);
      await notify(`❌ Error handling update: ${(err as Error).message}`).catch(
        () => {}
      );
      break; // on s'arrête, on retry au prochain run
    }
  }

  await writeJson(OFFSET_PATH, { last_id: maxId });
}

interface UpdateResult {
  pendingDirty: boolean;
  publishedDirty: boolean;
}

async function handleUpdate(
  update: TelegramUpdate,
  pending: PendingDrafts,
  published: PublishedPost[]
): Promise<UpdateResult> {
  // Case 1: button press (approve / skip)
  if (update.callback_query) {
    const cb = update.callback_query;
    const msgId = String(cb.message.message_id);
    const draft = pending[msgId];

    if (!draft) {
      await answerCallback(cb.id, "Draft not found (maybe already handled)");
      return { pendingDirty: false, publishedDirty: false };
    }

    if (cb.data === "approve") {
      await answerCallback(cb.id, "Publishing...");
      const result = await publishPost(draft.post_text, draft.image_path);
      await markIdea(IDEAS_PATH, draft.idea_id, "x");
      published.push({
        idea_id: draft.idea_id,
        text: draft.post_text,
        url: result.url,
        posted_at: new Date().toISOString(),
        edited: false,
      });
      delete pending[msgId];
      await notify(`✅ Posted to LinkedIn:\n${result.url}`);
      return { pendingDirty: true, publishedDirty: true };
    }

    if (cb.data === "skip") {
      await answerCallback(cb.id, "Regenerating...");

      const previousCount = draft.regen_count ?? 0;
      const nextCount = previousCount + 1;

      // Find the original idea text so we can re-feed it to the generator.
      const allIdeas = await parseIdeas(IDEAS_PATH);
      const idea = allIdeas.find((i) => i.id === draft.idea_id);

      // Whatever happens next, the current draft is dead.
      delete pending[msgId];

      if (!idea) {
        // Idea got deleted from the markdown file in the meantime. Edge case but possible.
        await notify(
          "❌ Skipped, but the original idea is gone from ideas.md. Skipping regeneration."
        );
        return { pendingDirty: true, publishedDirty: false };
      }

      if (nextCount > MAX_REGENS_PER_IDEA) {
        // Bail out: Claude has had 3 chances on this idea, time to give up gracefully.
        await notify(
          `⚠️ Skipped ${MAX_REGENS_PER_IDEA} drafts in a row on "${idea.text}". ` +
            `Stopping the loop. Either rephrase the idea in ideas.md or skip it manually with [~].`
        );
        return { pendingDirty: true, publishedDirty: false };
      }

      // Persist the deleted-old-draft state BEFORE generating, so the new draft
      // doesn't get cleared by the post-loop write.
      await writeJson(PENDING_PATH, pending);

      // Pass the idea back into the generator with an incremented regen_count.
      // The generator picks up regen_count from the forcedIdea and stores it on the new pending draft.
      const ideaWithCount = { ...idea, regen_count: nextCount } as Idea & {
        regen_count: number;
      };
      await generateAndSend(ideaWithCount);

      await notify(
        `🔄 Skipped. Generating attempt ${nextCount}/${MAX_REGENS_PER_IDEA} on the same idea.`
      );
      // generateAndSend has already written pending; tell the loop not to overwrite.
      return { pendingDirty: false, publishedDirty: false };
    }
  }

  // Case 2: reply with edited text
  if (update.message?.reply_to_message && update.message.text) {
    const replyToId = String(update.message.reply_to_message.message_id);
    const draft = pending[replyToId];
    if (!draft) return { pendingDirty: false, publishedDirty: false };

    const editedText = update.message.text;
    const result = await publishPost(editedText, draft.image_path);
    await markIdea(IDEAS_PATH, draft.idea_id, "x");
    published.push({
      idea_id: draft.idea_id,
      text: editedText,
      url: result.url,
      posted_at: new Date().toISOString(),
      edited: true,
    });
    delete pending[replyToId];
    await notify(`✅ Posted your edited version to LinkedIn:\n${result.url}`);
    return { pendingDirty: true, publishedDirty: true };
  }

  return { pendingDirty: false, publishedDirty: false };
}

main().catch((err) => {
  console.error(err);
  notify(`❌ Approval checker failed: ${err.message}`).catch(() => {});
  process.exit(1);
});
