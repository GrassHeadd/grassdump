import cron from "node-cron";
import {
  embedNote,
  getTodosDueSoon,
  getTodosJustDue,
  markReminderSent,
  getOverdueTodos,
  reactivateExpiredSnoozes,
} from "@repo/service";
import { sendMessage } from "../telegram/api";
import { formatReminderMessage } from "../telegram/formatter";
import { checkAndSendReminders } from "./reminders";

// ============================================================
// EVENT-TRIGGERED JOBS (fire-and-forget)
// ============================================================

/**
 * Run after a note is created or updated.
 * Generates an embedding from the summary and saves it to DB.
 */
export function runNoteJobs(data: {
  noteId: string;
  summary: string;
  userId: string;
  dueAt: string | null;
}) {
  // Fire-and-forget — don't block the caller
  embedNote(data.noteId, data.summary)
    .then(() => console.log(`[jobs] embedding saved for note ${data.noteId}`))
    .catch((err) =>
      console.error(`[jobs] embedding failed for note ${data.noteId}:`, err),
    );
}

// ============================================================
// CRON JOBS
// ============================================================

/**
 * Call once at server startup. Registers three crons:
 * 1. Every minute — check for todos that just became due, send reminders
 * 2. Every hour — daily digest (respects user timezone)
 *
 * TODO: add a cron to scan old dumps from non-agent flows (web/API) for
 * implicit commitments. Agent handles this inline now, but captureNote
 * doesn't go through the agent.
 */
export function startCronJobs() {
  // ---- Every minute: poll for due reminders ----
  cron.schedule("*/1 * * * *", async () => {
    try {
      await checkAndSendReminders({
        getTodosJustDue,
        markReminderSent,
        sendMessage,
      });
    } catch (err) {
      console.error("[cron:reminders] error:", err);
    }
  });

  // ---- Every hour: daily digest ----
  cron.schedule("0 * * * *", async () => {
    try {
      await reactivateExpiredSnoozes();

      const dueSoon = await getTodosDueSoon(24);
      if (dueSoon.length === 0) return;

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

      if (sent > 0) console.log(`[cron:digest] sent ${sent} digest(s)`);
    } catch (err) {
      console.error("[cron:digest] error:", err);
    }
  });

  console.log("[jobs] cron jobs started");
}

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
