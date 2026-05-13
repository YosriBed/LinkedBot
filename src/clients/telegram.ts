import { readFile } from "fs/promises";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function requireEnv() {
  if (!TOKEN || !CHAT_ID) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set");
  }
  return { token: TOKEN, chatId: CHAT_ID };
}

function base() {
  const { token } = requireEnv();
  return `https://api.telegram.org/bot${token}`;
}

export interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    data: string;
    message: { message_id: number };
    from: { id: number };
  };
  message?: {
    message_id: number;
    text?: string;
    reply_to_message?: { message_id: number };
    from: { id: number };
  };
}

/** Sends a draft post to Telegram. Returns the message_id so we can track approvals. */
export async function sendDraft(
  text: string,
  imagePath?: string
): Promise<number> {
  const { chatId } = requireEnv();

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: "approve" },
        { text: "❌ Skip", callback_data: "skip" },
      ],
    ],
  };

  // Telegram caption limit is 1024 chars for photos. If we have an image AND the post is long,
  // send them as two messages: photo first (no caption), then the text with buttons.
  if (imagePath) {
    const imageBuffer = await readFile(imagePath);
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append(
      "photo",
      new Blob([new Uint8Array(imageBuffer)]),
      "diagram.png"
    );

    const useCaption = text.length < 900;
    if (useCaption) {
      form.append(
        "caption",
        `📝 Draft:\n\n${text}\n\n(Reply to this message with edited text to publish a modified version.)`
      );
      form.append("reply_markup", JSON.stringify(keyboard));
      const r = await fetch(`${base()}/sendPhoto`, {
        method: "POST",
        body: form,
      });
      const data = await r.json();
      if (!data.ok)
        throw new Error(`Telegram sendPhoto failed: ${JSON.stringify(data)}`);
      return data.result.message_id;
    } else {
      // Send photo first without buttons
      const r1 = await fetch(`${base()}/sendPhoto`, {
        method: "POST",
        body: form,
      });
      const d1 = await r1.json();
      if (!d1.ok)
        throw new Error(`Telegram sendPhoto failed: ${JSON.stringify(d1)}`);
      // Then send text with buttons; the text message is the "approval anchor"
      return await sendText(text, keyboard);
    }
  }

  return await sendText(text, keyboard);
}

async function sendText(text: string, keyboard: unknown): Promise<number> {
  const { chatId } = requireEnv();
  const r = await fetch(`${base()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `📝 Draft:\n\n${text}\n\n(Reply to this message with edited text to publish a modified version.)`,
      reply_markup: keyboard,
    }),
  });
  const data = await r.json();
  if (!data.ok)
    throw new Error(`Telegram sendMessage failed: ${JSON.stringify(data)}`);
  return data.result.message_id;
}

/** Sends a plain notification message (no buttons). */
export async function notify(text: string): Promise<void> {
  const { chatId } = requireEnv();
  await fetch(`${base()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false,
    }),
  });
}

/** Gets updates (button presses, replies) since `offset`. */
export async function getUpdates(offset: number): Promise<TelegramUpdate[]> {
  const url =
    `${base()}/getUpdates?offset=${offset}&timeout=0` +
    `&allowed_updates=${encodeURIComponent(JSON.stringify(["message", "callback_query"]))}`;
  const r = await fetch(url);
  const data = await r.json();
  if (!data.ok)
    throw new Error(`Telegram getUpdates failed: ${JSON.stringify(data)}`);
  return data.result;
}

/** Acknowledges a button press so the spinner stops in the Telegram UI. */
export async function answerCallback(id: string, text: string): Promise<void> {
  await fetch(`${base()}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text }),
  });
}
