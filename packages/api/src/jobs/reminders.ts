import { formatReminderMessage } from "../telegram/formatter";

type SendMessage = (
  chatId: number,
  text: string,
  options?: { replyMarkup?: any },
) => Promise<any>;

export async function checkAndSendReminders(deps: {
  getTodosJustDue: () => Promise<any[]>;
  markReminderSent: (noteId: string) => Promise<any>;
  sendMessage: SendMessage;
}) {
  const dueTodos = await deps.getTodosJustDue();

  if (dueTodos.length === 0) return { sent: 0, skipped: 0 };

  console.log(`[cron:reminders] ${dueTodos.length} todo(s) just became due`);

  let sent = 0;
  let skipped = 0;

  for (const { note, user } of dueTodos) {
    if (!user.telegramId) {
      skipped++;
      continue;
    }

    const { text, replyMarkup } = formatReminderMessage(
      [{ id: note.id, summary: note.summary, dueAt: note.dueAt }],
      [],
    );
    await deps.sendMessage(user.telegramId, text, { replyMarkup });
    await deps.markReminderSent(note.id);
    sent++;
  }

  return { sent, skipped };
}
