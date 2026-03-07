import { Hono } from "hono";
import {
  getOrCreateUserByTelegramId,
  processMessage,
  flipNoteType,
  completeNote,
  cancelNote,
  updateNudgeStatus,
  updateNote,
} from "@repo/service";
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
  buildAgentKeyboard,
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

  // Run the agent loop — it decides whether to create, update, search, or complete
  console.log(`[agent] processing: "${text}"`);
  const result = await processMessage(user.id, text, "telegram", user.timezone);
  console.log(
    `[agent] reply: "${result.reply}", actions: ${result.actions.length}`,
  );

  // Trigger embedding jobs for any created/updated notes
  for (const action of result.actions) {
    if (
      action.type === "created_todo" ||
      action.type === "created_dump" ||
      action.type === "updated_note"
    ) {
      const note = action.note;
      runNoteJobs({
        noteId: note.id as string,
        summary: (note.summary as string) ?? text,
        userId: user.id,
        dueAt: note.dueAt ? (note.dueAt as Date).toISOString() : null,
      });
    }
  }

  // Send the agent's reply with action-based keyboard
  const replyMarkup = buildAgentKeyboard(result.actions);
  await sendMessage(chatId, result.reply, { replyMarkup });
  console.log("[agent] reply sent");
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
