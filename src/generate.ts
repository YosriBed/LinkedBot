import { readFile } from "fs/promises";
import { generatePost } from "./clients/anthropic.js";
import { sendDraft, notify } from "./clients/telegram.js";
import { pickIdea, type Idea } from "./utils/ideas.js";
import { renderMermaid } from "./utils/mermaid.js";
import {
  readJson,
  writeJson,
  type PendingDrafts,
  type PublishedPost,
} from "./utils/state.js";

const IDEAS_PATH = "content/ideas.md";
const VOICE_PATH = "content/voice.md";
const PENDING_PATH = "content/pending-drafts.json";
const PUBLISHED_PATH = "content/published.json";

/**
 * Picks an idea (unless one is forced), generates a post, sends it to Telegram,
 * and saves the draft to pending-drafts. Returns the message_id used, or null
 * if no idea was available.
 *
 * Exported so check-approval can reuse it for the "skip → regenerate" flow.
 */
export async function generateAndSend(
  forcedIdea?: Idea
): Promise<number | null> {
  const voice = await readFile(VOICE_PATH, "utf-8");
  const pending = await readJson<PendingDrafts>(PENDING_PATH, {});
  const published = await readJson<PublishedPost[]>(PUBLISHED_PATH, []);

  let idea: Idea | null;
  if (forcedIdea) {
    idea = forcedIdea;
  } else {
    const excludeIds = Object.values(pending).map((d) => d.idea_id);
    idea = await pickIdea(IDEAS_PATH, excludeIds);
  }

  if (!idea) {
    console.log("No available ideas. Add more to content/ideas.md.");
    await notify(
      "⚠️ LinkedIn bot ran but no ideas are available. Add some to ideas.md."
    );
    return null;
  }

  console.log(`Generating post for idea: "${idea.text}"`);

  const recentPosts = published
    .slice(-3)
    .map((p) => p.text)
    .join("\n---\n");

  const { postText, mermaid } = await generatePost({
    voice,
    idea: idea.text,
    recentPosts,
  });

  let imagePath: string | undefined;
  if (mermaid) {
    console.log("Rendering Mermaid diagram...");
    const rendered = await renderMermaid(mermaid);
    if (rendered) imagePath = rendered;
  }

  const messageId = await sendDraft(postText, imagePath);
  console.log(`Draft sent to Telegram, message_id=${messageId}`);

  pending[messageId] = {
    idea_id: idea.id,
    post_text: postText,
    image_path: imagePath,
    created_at: new Date().toISOString(),
    // Track regeneration count for the same idea, used for the skip-loop guard.
    regen_count: forcedIdea
      ? ((forcedIdea as Idea & { regen_count?: number }).regen_count ?? 0)
      : 0,
  };
  await writeJson(PENDING_PATH, pending);

  return messageId;
}

// CLI entry point: only runs when executed directly, not when imported.
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("generate.ts");
if (isMain) {
  generateAndSend().catch((err) => {
    console.error(err);
    notify(`❌ Generator failed: ${err.message}`).catch(() => {});
    process.exit(1);
  });
}
