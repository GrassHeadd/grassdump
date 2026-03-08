import type { InlineKeyboardMarkup, InlineKeyboardButton } from "./api";
import type { Action } from "@repo/core";

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
// CAPTURE REPLIES
// ============================================================

export function formatTodoReply(notes: NoteForReply[]): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
} {
  if (notes.length === 1) {
    const note = notes[0]!;
    let text = `got it — ${note.summary?.toLowerCase()}`;
    if (note.dueAt) text += `, ${formatDate(note.dueAt)}`;
    if (note.list) text += ` (${note.list})`;

    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: "done", callback_data: `complete:${note.id}` },
            { text: "undo", callback_data: `undo:${note.id}` },
          ],
        ],
      },
    };
  }

  const lines = notes.map((note) => {
    let line = `- ${note.summary?.toLowerCase()}`;
    if (note.dueAt) line += `, ${formatDate(note.dueAt)}`;
    if (note.list) line += ` (${note.list})`;
    return line;
  });

  const text = `got it, ${notes.length} things:\n${lines.join("\n")}`;

  const keyboard = notes.map((note) => [
    {
      text: `done: ${truncate(note.summary ?? "", 18)}`,
      callback_data: `complete:${note.id}`,
    },
    { text: "undo", callback_data: `undo:${note.id}` },
  ]);

  return { text, replyMarkup: { inline_keyboard: keyboard } };
}

export function formatDumpReply(note: NoteForReply): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
} {
  return {
    text: `noted — ${note.summary?.toLowerCase()}`,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "actually a task", callback_data: `flip:${note.id}` },
          { text: "undo", callback_data: `undo:${note.id}` },
        ],
      ],
    },
  };
}

// ============================================================
// REMINDER / NUDGE MESSAGES
// ============================================================

export function formatReminderMessage(
  dueTodos: TodoForReminder[],
  overdueTodos: TodoForReminder[],
): { text: string; replyMarkup: InlineKeyboardMarkup } {
  const lines: string[] = [];

  if (overdueTodos.length > 0) {
    lines.push(
      overdueTodos.length === 1 ? "this is overdue:" : "these are overdue:",
    );
    overdueTodos.forEach((t) => lines.push(`- ${t.summary?.toLowerCase()}`));
    if (dueTodos.length > 0) lines.push("");
  }

  if (dueTodos.length > 0) {
    lines.push(
      dueTodos.length === 1 ? "hey, this is due:" : "heads up, due today:",
    );
    dueTodos.forEach((t) => lines.push(`- ${t.summary?.toLowerCase()}`));
  }

  const text = lines.join("\n");

  const allTodos = [...overdueTodos, ...dueTodos];
  const keyboard = allTodos.map((t) => [
    {
      text: `done: ${truncate(t.summary ?? "", 18)}`,
      callback_data: `complete:${t.id}`,
    },
    { text: "tmr", callback_data: `tomorrow:${t.id}` },
  ]);

  return { text, replyMarkup: { inline_keyboard: keyboard } };
}

export function formatNudgeMessage(
  note: { id: string; summary: string | null },
  reason: string,
): { text: string; replyMarkup: InlineKeyboardMarkup } {
  const text = `you mentioned "${note.summary?.toLowerCase()}" a while back — ${reason.toLowerCase()}\n\nwant me to make it a task?`;

  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "yea", callback_data: `flip:${note.id}` },
          { text: "later", callback_data: `snooze:${note.id}` },
          { text: "nah", callback_data: `dismiss:${note.id}` },
        ],
      ],
    },
  };
}

// ============================================================
// SEARCH RESULTS
// ============================================================

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "nothing found";

  const lines = results.map((r, i) => {
    const tag = r.type === "todo" ? "task" : "note";
    return `${i + 1}. ${r.summary?.toLowerCase()} (${tag})`;
  });

  return lines.join("\n");
}

// ============================================================
// AGENT KEYBOARD
// ============================================================
// Builds inline keyboard buttons from agent actions.
// The reply text comes from the agent — this only handles buttons.

export function buildAgentKeyboard(
  actions: Action[],
): InlineKeyboardMarkup | undefined {
  const rows: InlineKeyboardButton[][] = [];

  for (const action of actions) {
    switch (action.type) {
      case "created_todo": {
        const id = action.note.id as string;
        rows.push([
          { text: "done", callback_data: `complete:${id}` },
          { text: "undo", callback_data: `undo:${id}` },
        ]);
        break;
      }
      case "created_dump": {
        const id = action.note.id as string;
        rows.push([
          { text: "actually a task", callback_data: `flip:${id}` },
          { text: "undo", callback_data: `undo:${id}` },
        ]);
        break;
      }
      case "updated_note": {
        const id = action.note.id as string;
        const type = action.note.type as string;
        if (type === "todo") {
          rows.push([{ text: "done", callback_data: `complete:${id}` }]);
        }
        break;
      }
      // completed_note and search_results don't need buttons
    }
  }

  return rows.length > 0 ? { inline_keyboard: rows } : undefined;
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(date: Date): string {
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;

  if (hasTime) {
    return date
      .toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
      .toLowerCase();
  }

  return date
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toLowerCase();
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "..." : str;
}
