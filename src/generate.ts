import { readFile } from 'fs/promises';
import { generatePost } from './clients/anthropic.js';
import { sendDraft, notify } from './clients/telegram.js';
import { pickIdea } from './utils/ideas.js';
import { renderMermaid } from './utils/mermaid.js';
import { readJson, writeJson, type PendingDrafts, type PublishedPost } from './utils/state.js';

const IDEAS_PATH = 'content/ideas.md';
const VOICE_PATH = 'content/voice.md';
const PENDING_PATH = 'content/pending-drafts.json';
const PUBLISHED_PATH = 'content/published.json';

async function main() {
  const voice = await readFile(VOICE_PATH, 'utf-8');
  const pending = await readJson<PendingDrafts>(PENDING_PATH, {});
  const published = await readJson<PublishedPost[]>(PUBLISHED_PATH, []);

  const excludeIds = Object.values(pending).map((d) => d.idea_id);
  const idea = await pickIdea(IDEAS_PATH, excludeIds);

  if (!idea) {
    console.log('No available ideas. Add more to content/ideas.md.');
    await notify('⚠️ LinkedIn bot ran but no ideas are available. Add some to ideas.md.');
    return;
  }

  console.log(`Generating post for idea: "${idea.text}"`);

  const recentPosts = published
    .slice(-3)
    .map((p) => p.text)
    .join('\n---\n');

  const { postText, mermaid } = await generatePost({
    voice,
    idea: idea.text,
    recentPosts,
  });

  let imagePath: string | undefined;
  if (mermaid) {
    console.log('Rendering Mermaid diagram...');
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
  };
  await writeJson(PENDING_PATH, pending);
}

main().catch((err) => {
  console.error(err);
  // Best-effort notify on failure — but don't let notification errors mask the real error
  notify(`❌ Generator failed: ${err.message}`).catch(() => {});
  process.exit(1);
});
