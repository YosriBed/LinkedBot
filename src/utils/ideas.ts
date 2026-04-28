import { readFile, writeFile } from "fs/promises";
import { createHash } from "crypto";

export type IdeaStatus = " " | "x" | "~";

export interface Idea {
  id: string; // stable hash of the text, 8 chars
  text: string;
  status: IdeaStatus;
}

/** Parses ideas.md. An "idea" is a line of the form `- [ ] text` / `- [x] text` / `- [~] text`. */
export async function parseIdeas(path: string): Promise<Idea[]> {
  const content = await readFile(path, "utf-8");
  const ideas: Idea[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^- \[([ x~])\] (.+)$/);
    if (!match) continue;
    const [, status, text] = match;
    ideas.push({
      id: hashIdea(text),
      text: text.trim(),
      status: status as IdeaStatus,
    });
  }
  return ideas;
}

/** Picks a random unused idea. Pass excludeIds to avoid ideas already in pending-drafts. */
export async function pickIdea(
  path: string,
  excludeIds: string[] = []
): Promise<Idea | null> {
  const ideas = await parseIdeas(path);
  const available = ideas.filter(
    (i) => i.status === " " && !excludeIds.includes(i.id)
  );
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/** Updates the status of an idea in place by rewriting the file. */
export async function markIdea(
  path: string,
  ideaId: string,
  newStatus: "x" | "~"
): Promise<void> {
  const content = await readFile(path, "utf-8");
  const lines = content.split("\n").map((line) => {
    const match = line.match(/^- \[([ x~])\] (.+)$/);
    if (!match) return line;
    const id = hashIdea(match[2]);
    if (id === ideaId) return `- [${newStatus}] ${match[2]}`;
    return line;
  });
  await writeFile(path, lines.join("\n"));
}

function hashIdea(text: string): string {
  return createHash("sha1").update(text.trim()).digest("hex").slice(0, 8);
}
