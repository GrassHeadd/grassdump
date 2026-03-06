import { Hono } from "hono";
import { getOrCreateUserByTelegramId } from "@repo/db";
import {
  captureNote,
  flipNoteType,
  completeNote,
  cancelNote,
  search,
} from "@repo/service";
import { updateNudgeStatus } from "@repo/db";
import { runNoteJobs } from "../jobs";
import {
  sendMessage,
  sendChatAction,
  editMessageText,
  answerCallbackQuery,
  type TelegramUpdate,
} from "./api";
import {
  formatTodoReply,
  formatDumpReply,
  formatSearchResults,
} from "./formatter";

const telegram = new Hono();

// ============================================================
// WEBHOOK ENDPOINT
// ============================================================
// Telegram POSTs here whenever someone messages the bot or taps a button.
// Always return 200 — if we return an error, Telegram retries and we
// get duplicate processing.

telegram.post("/telegram", async (c) => {
  const update: TelegramUpdate = await c.req.json();
  console.log(
    "[webhook] received update:",
    update.message?.text ?? update.callback_query?.data ?? "unknown",
  );

  try {
    if (update.message?.text) {
      await handleTextMessage(
        update.message.chat.id,
        update.message.from!.id,
        update.message.text,
      );
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
  } catch (err) {
    console.error("[webhook] error:", err);
  }

  return c.json({ ok: true });
});

// ============================================================
// TEXT MESSAGES
// ============================================================

async function handleTextMessage(
  chatId: number,
  telegramUserId: number,
  text: string,
) {
  // Show "typing..." while we process
  await sendChatAction(chatId);

  // Look up or create the user
  const user = await getOrCreateUserByTelegramId(telegramUserId);

  // If it looks like a question, search instead of capture
  if (looksLikeQuestion(text)) {
    await handleSearch(chatId, user.id, text);
    return;
  }

  // Classify and save
  console.log(`[capture] classifying: "${text}"`);
  const result = await captureNote(user.id, text, "telegram", user.timezone);
  console.log(`[capture] type: ${result.type}, notes: ${result.notes.length}`);

  for (const note of result.notes) {
    console.log(
      `[capture] note ${note.id}: "${note.summary}", dueAt: ${note.dueAt?.toISOString() ?? "none"}`,
    );
  }

  // Trigger async jobs (embedding generation) for each note — fire-and-forget.
  for (const note of result.notes) {
    runNoteJobs({
      noteId: note.id,
      summary: note.summary ?? text,
      userId: user.id,
      dueAt: note.dueAt?.toISOString() ?? null,
    });
  }
  console.log(`[capture] queued ${result.notes.length} background jobs`);

  // Reply with what we parsed
  if (result.type === "todo") {
    const { text: replyText, replyMarkup } = formatTodoReply(result.notes);
    await sendMessage(chatId, replyText, { replyMarkup });
  } else {
    const { text: replyText, replyMarkup } = formatDumpReply(result.notes[0]!);
    await sendMessage(chatId, replyText, { replyMarkup });
  }
  console.log("[capture] reply sent");
}

async function handleSearch(chatId: number, userId: string, query: string) {
  const results = await search(userId, query);
  const text = formatSearchResults(
    results.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      summary: r.summary as string | null,
      type: r.type as string,
      similarity: Number(r.similarity),
    })),
  );
  await sendMessage(chatId, text);
}

// Simple heuristic: if it contains "?" or starts with a question word, treat as search.
function looksLikeQuestion(text: string): boolean {
  if (text.includes("?")) return true;
  const lower = text.toLowerCase().trim();
  const questionWords = [
    "what",
    "where",
    "when",
    "who",
    "how",
    "which",
    "find",
    "search",
  ];
  return questionWords.some((w) => lower.startsWith(w + " "));
}

// ============================================================
// CALLBACK QUERIES (button taps)
// ============================================================

async function handleCallbackQuery(query: {
  id: string;
  from: { id: number };
  message?: { message_id: number; chat: { id: number } };
  data?: string;
}) {
  if (!query.data || !query.message) {
    await answerCallbackQuery(query.id);
    return;
  }

  const [action, noteId] = query.data.split(":");
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  if (!noteId) {
    await answerCallbackQuery(query.id, "Invalid action");
    return;
  }

  try {
    switch (action) {
      case "complete": {
        const completed = await completeNote(noteId);
        const summary = completed?.summary ?? "task";
        await editMessageText(chatId, messageId, `~${summary}~ Done`, {
          parseMode: "MarkdownV2",
        });
        await answerCallbackQuery(query.id, "Completed");
        break;
      }

      case "undo": {
        await cancelNote(noteId);
        await editMessageText(chatId, messageId, "Undone.");
        await answerCallbackQuery(query.id, "Undone");
        break;
      }

      case "flip": {
        const user = await getOrCreateUserByTelegramId(query.from.id);
        const updated = await flipNoteType(noteId, "todo", user.timezone);
        if (updated) {
          const { text, replyMarkup } = formatTodoReply([updated]);
          await editMessageText(chatId, messageId, text, { replyMarkup });
          // Re-embed with updated summary
          runNoteJobs({
            noteId: updated.id,
            summary: updated.summary ?? "",
            userId: user.id,
            dueAt: updated.dueAt?.toISOString() ?? null,
          });
        }
        await answerCallbackQuery(query.id, "Converted to task");
        break;
      }

      case "tomorrow": {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        // Import updateNote dynamically to avoid circular deps
        const { updateNote } = await import("@repo/db");
        await updateNote(noteId, { dueAt: tomorrow });
        await editMessageText(chatId, messageId, "Rescheduled to tomorrow.");
        await answerCallbackQuery(query.id, "Moved to tomorrow");
        break;
      }

      case "snooze": {
        const snoozeUntil = new Date();
        snoozeUntil.setDate(snoozeUntil.getDate() + 3);
        await updateNudgeStatus(noteId, "snoozed", snoozeUntil);
        await editMessageText(chatId, messageId, "Snoozed for 3 days.");
        await answerCallbackQuery(query.id, "Snoozed");
        break;
      }

      case "dismiss": {
        await updateNudgeStatus(noteId, "dismissed");
        await editMessageText(chatId, messageId, "Dismissed.");
        await answerCallbackQuery(query.id, "Dismissed");
        break;
      }

      default:
        await answerCallbackQuery(query.id, "Unknown action");
    }
  } catch (err) {
    console.error(`Callback error (${action}:${noteId}):`, err);
    await answerCallbackQuery(query.id, "Something went wrong");
  }
}

export { telegram as telegramWebhook };
