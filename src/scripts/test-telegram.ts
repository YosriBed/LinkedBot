import { sendDraft, notify } from "../clients/telegram.js";

async function main() {
  await notify("🔔 Telegram test: plain notification works.");

  const msgId = await sendDraft(
    "This is a test draft. If you can see the Approve/Skip buttons, Telegram is wired up correctly. " +
      "Try replying to this message with some text to test the edit flow (nothing will actually be posted — this is just a connectivity test)."
  );

  console.log(`Sent test draft, message_id=${msgId}`);
  console.log(
    "Check your Telegram. Buttons should work. To actually process approvals you need to run check-approval."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
