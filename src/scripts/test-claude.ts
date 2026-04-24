import { readFile } from "fs/promises";
import { generatePost } from "../clients/anthropic.js";

async function main() {
  const voice = await readFile("content/voice.md", "utf-8");
  const testIdea =
    "Why I stopped using barrel exports in TypeScript after a week of circular import hell";

  console.log("Calling Claude...\n");
  const result = await generatePost({
    voice,
    idea: testIdea,
    recentPosts: "",
  });

  console.log("=== POST ===");
  console.log(result.postText);
  console.log("\n=== MERMAID ===");
  console.log(result.mermaid ?? "(none)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
