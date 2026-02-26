import { generateEmbedding } from "@repo/ai";
import {
  updateEmbedding,
  getTodosDueSoon,
  getOverdueTodos,
  findUserById,
  updateNudgeStatus,
} from "@repo/db";
import {
  scanForStaleCommitments,
  reactivateExpiredSnoozes,
} from "@repo/service";
import { sendMessage } from "../telegram/api";
import {
  formatReminderMessage,
  formatNudgeMessage,
} from "../telegram/formatter";
import { inngest } from "./client";

// ============================================================
// 1. GENERATE EMBEDDING (event-driven)
// ============================================================
// Fires when a note is created or edited.
// Generates a vector embedding from the summary and saves it to the DB.

const generateEmbeddingFn = inngest.createFunction(
  { id: "generate-embedding" },
  [{ event: "note/created" }, { event: "note/updated" }],
  async ({ event }) => {
    const { noteId, summary } = event.data;

    const embedding = await generateEmbedding(summary);
    await updateEmbedding(noteId, embedding);

    return { noteId, dimensions: embedding.length };
  },
);

// ============================================================
// 2. DAILY REMINDERS (cron — every hour)
// ============================================================
// Runs hourly because users have different timezones.
// Checks if the current hour matches each user's digestTime,
// then sends due + overdue todos via Telegram.
// Also reactivates any expired snoozes.

const dailyRemindersFn = inngest.createFunction(
  { id: "daily-reminders" },
  { cron: "0 * * * *" },
  async () => {
    await reactivateExpiredSnoozes();

    const dueSoon = await getTodosDueSoon(24);
    if (dueSoon.length === 0) return { sent: 0 };

    // Group by user
    const byUser = new Map<
      string,
      { telegramId: number | null; timezone: string; todos: typeof dueSoon }
    >();

    for (const row of dueSoon) {
      const userId = row.note.userId;
      if (!byUser.has(userId)) {
        byUser.set(userId, {
          telegramId: row.user.telegramId,
          timezone: row.user.timezone,
          todos: [],
        });
      }
      byUser.get(userId)!.todos.push(row);
    }

    let sent = 0;

    for (const [userId, data] of byUser) {
      if (!data.telegramId) continue;

      // Only send if current hour matches their digest time (default 8 AM)
      const userHour = getHourInTimezone(new Date(), data.timezone);
      if (userHour !== 8) continue;

      const overdue = await getOverdueTodos(userId);

      const dueTodos = data.todos.map((r) => ({
        id: r.note.id,
        summary: r.note.summary,
        dueAt: r.note.dueAt,
      }));

      const overdueTodos = overdue.map((n) => ({
        id: n.id,
        summary: n.summary,
        dueAt: n.dueAt,
      }));

      if (dueTodos.length === 0 && overdueTodos.length === 0) continue;

      const { text, replyMarkup } = formatReminderMessage(
        dueTodos,
        overdueTodos,
      );
      await sendMessage(data.telegramId, text, { replyMarkup });
      sent++;
    }

    return { sent };
  },
);

// ============================================================
// 3. STALE COMMITMENT SCAN (cron — daily at 9 AM UTC)
// ============================================================
// Finds old dumps with implicit commitments via LLM,
// then sends a Telegram nudge asking if the user wants to make it a task.

const staleCommitmentScanFn = inngest.createFunction(
  { id: "stale-commitment-scan" },
  { cron: "0 9 * * *" },
  async () => {
    const flagged = await scanForStaleCommitments();

    let sent = 0;

    for (const { note, reason } of flagged) {
      const user = await findUserById(note.userId);
      if (!user?.telegramId) continue;

      const { text, replyMarkup } = formatNudgeMessage(
        { id: note.id, summary: note.summary },
        reason,
      );

      await sendMessage(user.telegramId, text, { replyMarkup });
      await updateNudgeStatus(note.id, "sent");
      sent++;
    }

    return { flagged: flagged.length, sent };
  },
);

// ============================================================
// 4. SCHEDULED REMINDER (event-driven)
// ============================================================
// When a todo is created with a due date, this function sleeps
// until that exact time, then sends a Telegram reminder.
// Way more precise than polling — "remind me in 10 minutes" works.

const scheduledReminderFn = inngest.createFunction(
  { id: "scheduled-reminder" },
  [{ event: "note/created" }, { event: "note/updated" }],
  async ({ event, step }) => {
    const { noteId, summary, userId, dueAt } = event.data;
    console.log(
      `[reminder] received event for note ${noteId}, dueAt: ${dueAt}, userId: ${userId}`,
    );

    if (!dueAt) {
      console.log("[reminder] no due date, skipping");
      return { skipped: true };
    }

    const shouldSchedule = await step.run("check-due-date", async () => {
      const dueDate = new Date(dueAt);
      const isPast = dueDate <= new Date();
      console.log(
        `[reminder] dueDate: ${dueDate.toISOString()}, isPast: ${isPast}`,
      );
      return !isPast;
    });

    if (!shouldSchedule) {
      console.log("[reminder] due date already past, skipping");
      return { skipped: true, reason: "already past" };
    }

    console.log(`[reminder] sleeping until ${dueAt}`);
    await step.sleepUntil("wait-for-due-date", new Date(dueAt));

    console.log("[reminder] woke up, checking note status");
    const { getNoteById, findUserById: getUser } = await import("@repo/db");
    const note = await step.run("check-note", async () => {
      return getNoteById(noteId);
    });

    if (!note || note.status !== "pending") {
      console.log(
        `[reminder] note ${noteId} is ${note?.status ?? "missing"}, skipping`,
      );
      return { skipped: true, reason: "no longer pending" };
    }

    const user = await step.run("get-user", async () => {
      return getUser(userId);
    });

    if (!user?.telegramId) {
      console.log(`[reminder] user ${userId} has no telegramId, skipping`);
      return { skipped: true, reason: "no telegram" };
    }

    console.log(
      `[reminder] sending reminder to telegram user ${user.telegramId}`,
    );
    await step.run("send-reminder", async () => {
      const { text, replyMarkup } = formatReminderMessage(
        [{ id: note.id, summary: note.summary, dueAt: note.dueAt }],
        [],
      );
      await sendMessage(user.telegramId!, text, { replyMarkup });
    });

    console.log(`[reminder] sent reminder for note ${noteId}`);
    return { sent: true, noteId };
  },
);

// ============================================================
// HELPERS
// ============================================================

function getHourInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: timezone,
  });
  return parseInt(formatter.format(date), 10);
}

// All functions as an array — this is what Inngest's serve() expects.
export const functions = [
  generateEmbeddingFn,
  dailyRemindersFn,
  staleCommitmentScanFn,
  scheduledReminderFn,
];
