import { publishPost } from "../clients/linkedin.js";

async function main() {
  console.log("⚠️  This will post a REAL message to your LinkedIn feed.");
  console.log("⚠️  Ctrl+C within 5 seconds to abort.\n");
  await new Promise((r) => setTimeout(r, 5000));

  const testText =
    "Testing my LinkedIn API integration. If you see this post, the OAuth flow and `w_member_social` scope are working correctly. " +
    "Feel free to ignore — I will delete it in a few minutes.";

  const result = await publishPost(testText);
  console.log(`\n✅ Posted! URL: ${result.url}`);
  console.log(`   ID:  ${result.id}`);
  console.log(
    "\nGo delete it from your LinkedIn feed when you are done verifying.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
