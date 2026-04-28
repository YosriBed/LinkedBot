import { readFile, writeFile } from "fs/promises";

export interface PendingDraft {
  idea_id: string;
  post_text: string;
  image_path?: string;
  created_at: string;
  /** Number of times this idea has been regenerated in a row via skip. Used to cap the skip loop. */
  regen_count?: number;
}

export type PendingDrafts = Record<string, PendingDraft>; // keyed by telegram message_id

export interface PublishedPost {
  idea_id: string;
  text: string;
  url: string;
  posted_at: string;
  edited: boolean;
}

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}
