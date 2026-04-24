import { getUpdates, answerCallback, notify, type TelegramUpdate } from './clients/telegram.js';
import { publishPost } from './clients/linkedin.js';
import { markIdea } from './utils/ideas.js';
import { readJson, writeJson, type PendingDrafts, type PublishedPost } from './utils/state.js';

const IDEAS_PATH = 'content/ideas.md';
const PENDING_PATH = 'content/pending-drafts.json';
const PUBLISHED_PATH = 'content/published.json';
const OFFSET_PATH = 'content/last-update-id.json';

interface OffsetFile {
  last_id: number;
}

async function main() {
  const offsetFile = await readJson<OffsetFile>(OFFSET_PATH, { last_id: 0 });
  const updates = await getUpdates(offsetFile.last_id + 1);

  if (updates.length === 0) {
    console.log('No new Telegram updates.');
    return;
  }

  console.log(`Processing ${updates.length} Telegram update(s)...`);

  const pending = await readJson<PendingDrafts>(PENDING_PATH, {});
  const published = await readJson<PublishedPost[]>(PUBLISHED_PATH, []);

  let maxId = offsetFile.last_id;

  for (const update of updates) {
    maxId = Math.max(maxId, update.update_id);
    try {
      await handleUpdate(update, pending, published);
    } catch (err) {
      console.error(`Failed to handle update ${update.update_id}:`, err);
      await notify(`❌ Error handling update: ${(err as Error).message}`).catch(() => {});
    }
  }

  await writeJson(OFFSET_PATH, { last_id: maxId });
  await writeJson(PENDING_PATH, pending);
  await writeJson(PUBLISHED_PATH, published);
}

async function handleUpdate(
  update: TelegramUpdate,
  pending: PendingDrafts,
  published: PublishedPost[]
): Promise<void> {
  // Case 1: button press (approve / skip)
  if (update.callback_query) {
    const cb = update.callback_query;
    const msgId = String(cb.message.message_id);
    const draft = pending[msgId];

    if (!draft) {
      await answerCallback(cb.id, 'Draft not found (maybe already handled)');
      return;
    }

    if (cb.data === 'approve') {
      await answerCallback(cb.id, 'Publishing...');
      const result = await publishPost(draft.post_text, draft.image_path);
      await markIdea(IDEAS_PATH, draft.idea_id, 'x');
      published.push({
        idea_id: draft.idea_id,
        text: draft.post_text,
        url: result.url,
        posted_at: new Date().toISOString(),
        edited: false,
      });
      delete pending[msgId];
      await notify(`✅ Posted to LinkedIn:\n${result.url}`);
    } else if (cb.data === 'skip') {
      await answerCallback(cb.id, 'Skipped');
      await markIdea(IDEAS_PATH, draft.idea_id, '~');
      delete pending[msgId];
      await notify(`❌ Skipped. Idea marked as [~] in ideas.md.`);
    }
    return;
  }

  // Case 2: reply with edited text
  if (update.message?.reply_to_message && update.message.text) {
    const replyToId = String(update.message.reply_to_message.message_id);
    const draft = pending[replyToId];
    if (!draft) return; // not a reply to one of our drafts

    const editedText = update.message.text;
    const result = await publishPost(editedText, draft.image_path);
    await markIdea(IDEAS_PATH, draft.idea_id, 'x');
    published.push({
      idea_id: draft.idea_id,
      text: editedText,
      url: result.url,
      posted_at: new Date().toISOString(),
      edited: true,
    });
    delete pending[replyToId];
    await notify(`✅ Posted your edited version to LinkedIn:\n${result.url}`);
  }
}

main().catch((err) => {
  console.error(err);
  notify(`❌ Approval checker failed: ${err.message}`).catch(() => {});
  process.exit(1);
});
