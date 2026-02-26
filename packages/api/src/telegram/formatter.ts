import type { InlineKeyboardMarkup } from "./api";

// ============================================================
// TYPES
// ============================================================

type NoteForReply = {
  id: string;
  summary: string | null;
  dueAt: Date | null;
  list: string | null;
  priority: string | null;
};

type SearchResult = {
  id: string;
  summary: string | null;
  type: string;
  similarity: number;
};

type TodoForReminder = {
  id: string;
  summary: string | null;
  dueAt: Date | null;
};

// ============================================================
// CAPTURE REPLIES (what the bot sends after you message it)
// ============================================================

export function formatTodoReply(notes: NoteForReply[]): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
} {
  const lines = notes.map((note, i) => {
    let line = `${notes.length > 1 ? `${i + 1}. ` : ""}${note.summary}`;
    if (note.dueAt) {
      line += ` — Due: ${formatDate(note.dueAt)}`;
    }
    if (note.list) {
      line += ` — List: ${titleCase(note.list)}`;
    }
    return line;
  });

  const header =
    notes.length === 1 ? "Saved todo:" : `Saved ${notes.length} todos:`;
  const text = `${header}\n${lines.join("\n")}`;

  // Each note gets its own row of Undo/Complete buttons
  const keyboard = notes.map((note) => [
    { text: "Done", callback_data: `complete:${note.id}` },
    { text: "Undo", callback_data: `undo:${note.id}` },
  ]);

  return { text, replyMarkup: { inline_keyboard: keyboard } };
}

export function formatDumpReply(note: NoteForReply): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
} {
  const text = `Noted: "${note.summary}"`;

  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "Actually a task", callback_data: `flip:${note.id}` },
          { text: "Undo", callback_data: `undo:${note.id}` },
        ],
      ],
    },
  };
}

// ============================================================
// REMINDER / NUDGE MESSAGES (sent by cron jobs)
// ============================================================

export function formatReminderMessage(
  dueTodos: TodoForReminder[],
  overdueTodos: TodoForReminder[],
): { text: string; replyMarkup: InlineKeyboardMarkup } {
  const lines: string[] = [];

  if (overdueTodos.length > 0) {
    lines.push(`Overdue (${overdueTodos.length}):`);
    overdueTodos.forEach((t) => lines.push(`  - ${t.summary}`));
    lines.push("");
  }

  if (dueTodos.length > 0) {
    lines.push(`Due today (${dueTodos.length}):`);
    dueTodos.forEach((t) => lines.push(`  - ${t.summary}`));
  }

  const text = lines.join("\n");

  // Flatten all todos into button rows
  const allTodos = [...overdueTodos, ...dueTodos];
  const keyboard = allTodos.map((t) => [
    {
      text: `Done: ${truncate(t.summary ?? "", 20)}`,
      callback_data: `complete:${t.id}`,
    },
    { text: "Tomorrow", callback_data: `tomorrow:${t.id}` },
  ]);

  return { text, replyMarkup: { inline_keyboard: keyboard } };
}

export function formatNudgeMessage(
  note: { id: string; summary: string | null },
  reason: string,
): { text: string; replyMarkup: InlineKeyboardMarkup } {
  const text = `You mentioned "${note.summary}" a while ago. ${reason}\n\nWant me to make that a task?`;

  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "Yes, make it a task", callback_data: `flip:${note.id}` },
          { text: "Remind later", callback_data: `snooze:${note.id}` },
          { text: "Dismiss", callback_data: `dismiss:${note.id}` },
        ],
      ],
    },
  };
}

// ============================================================
// SEARCH RESULTS
// ============================================================

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "No results found.";

  const lines = results.map((r, i) => {
    const type = r.type === "todo" ? "[todo]" : "[dump]";
    const pct = Math.round(r.similarity * 100);
    return `${i + 1}. ${type} ${r.summary} (${pct}% match)`;
  });

  return lines.join("\n");
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "..." : str;
}
