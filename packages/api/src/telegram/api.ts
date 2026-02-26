// ============================================================
// TELEGRAM BOT API TYPES
// ============================================================
// These match what Telegram sends/expects. Not exhaustive — just what we need.

export type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

// What Telegram POSTs to our webhook when someone messages the bot
export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: CallbackQuery;
};

export type TelegramMessage = {
  message_id: number;
  from?: { id: number; first_name: string };
  chat: { id: number };
  text?: string;
};

// When someone taps an inline keyboard button
export type CallbackQuery = {
  id: string;
  from: { id: number };
  message?: TelegramMessage;
  data?: string; // the callback_data from the button they tapped
};

// ============================================================
// API HELPERS
// ============================================================

// Every Telegram API call goes through this. Reads token from env,
// POSTs to https://api.telegram.org/bot<token>/<method>.
async function callTelegramApi(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Telegram API ${method} failed: ${error}`);
  }

  return res.json();
}

// ============================================================
// BOT ACTIONS
// ============================================================

// Send a text message. Optionally attach an inline keyboard (buttons below the message).
export async function sendMessage(
  chatId: number,
  text: string,
  options?: { replyMarkup?: InlineKeyboardMarkup; parseMode?: string },
) {
  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode,
    reply_markup: options?.replyMarkup,
  });
}

// Shows "typing..." in the chat while we process the message.
export async function sendChatAction(
  chatId: number,
  action: string = "typing",
) {
  return callTelegramApi("sendChatAction", {
    chat_id: chatId,
    action,
  });
}

// Update an existing message's text (e.g. after a button tap).
export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  options?: { replyMarkup?: InlineKeyboardMarkup; parseMode?: string },
) {
  return callTelegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: options?.parseMode,
    reply_markup: options?.replyMarkup,
  });
}

// Acknowledge a button tap. Telegram shows a loading spinner until you call this.
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
) {
  return callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

// Delete a message (used for undo).
export async function deleteMessage(chatId: number, messageId: number) {
  return callTelegramApi("deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
}

// Register our webhook URL with Telegram. Call once during setup.
export async function setWebhook(url: string) {
  return callTelegramApi("setWebhook", { url });
}
