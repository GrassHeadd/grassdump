import { classifyAndParse, reparseAsType, generateEmbedding } from "@repo/ai";
import { resolveDateExpression } from "@repo/core";
import type { Source, NoteType } from "@repo/core";
import {
  createNote,
  updateNote,
  getNoteById,
  completeNote as dbComplete,
  uncompleteNote as dbUncomplete,
  cancelNote as dbCancel,
  getTodosDueToday,
  getOverdueTodos,
  getTodosUpcoming,
  getDumpFeed,
  getRecentDumps,
  semanticSearch as dbSearch,
  getDistinctLists,
} from "@repo/db";

// ============================================================
// CREATE NOTE
// ============================================================
// The main capture flow:
// 1. Send raw input to AI for classification
// 2. Resolve any date expressions to actual dates
// 3. Save each parsed item as a note
// 4. Return the created notes (caller triggers embedding job)

export async function captureNote(
  userId: string,
  rawInput: string,
  source: Source,
  timezone: string = "UTC",
) {
  const classification = await classifyAndParse(rawInput, timezone);

  const createdNotes = [];

  for (const item of classification.items) {
    // Resolve "next tuesday" → actual Date
    const dueAt = item.dueExpression
      ? resolveDateExpression(item.dueExpression, new Date(), timezone)
      : null;

    const note = await createNote({
      userId,
      rawInput,
      summary: item.summary,
      type: classification.type,
      source,
      status: classification.type === "todo" ? "pending" : null,
      list: item.list?.toLowerCase().trim() ?? null,
      dueAt,
      priority:
        item.priority ?? (classification.type === "todo" ? "normal" : null),
    });

    createdNotes.push(note);
  }

  return { type: classification.type, notes: createdNotes };
}

// ============================================================
// TYPE FLIP
// ============================================================
// User taps "Actually a task" or "Actually a dump" — re-parse with forced type.

export async function flipNoteType(
  noteId: string,
  newType: NoteType,
  timezone: string = "UTC",
) {
  const existing = await getNoteById(noteId);
  if (!existing) throw new Error("Note not found");

  const result = await reparseAsType(existing.rawInput, newType);
  const item = result.items[0];
  if (!item) throw new Error("Re-parse returned no items");

  const dueAt = item.dueExpression
    ? resolveDateExpression(item.dueExpression, new Date(), timezone)
    : null;

  const updated = await updateNote(noteId, {
    type: newType,
    summary: item.summary,
    status: newType === "todo" ? "pending" : null,
    list: item.list?.toLowerCase().trim() ?? null,
    dueAt,
    priority: item.priority ?? (newType === "todo" ? "normal" : null),
  });

  return updated;
}

// ============================================================
// SEARCH
// ============================================================

export async function search(
  userId: string,
  query: string,
  limit: number = 10,
) {
  const queryEmbedding = await generateEmbedding(query);
  return dbSearch(userId, queryEmbedding, limit);
}

// ============================================================
// VIEWS (thin wrappers, but keeps api layer from importing db directly)
// ============================================================

export async function getTodayView(userId: string) {
  const [overdue, today, upcoming, recentDumps] = await Promise.all([
    getOverdueTodos(userId),
    getTodosDueToday(userId),
    getTodosUpcoming(userId),
    getRecentDumps(userId),
  ]);

  return { overdue, today, upcoming, recentDumps };
}

export { getDumpFeed, getDistinctLists };

// ============================================================
// ACTIONS
// ============================================================

export async function completeNote(noteId: string) {
  return dbComplete(noteId);
}

export async function uncompleteNote(noteId: string) {
  return dbUncomplete(noteId);
}

export async function cancelNote(noteId: string) {
  return dbCancel(noteId);
}

// ============================================================
// UPDATE
// ============================================================

export async function editNote(
  noteId: string,
  data: {
    summary?: string;
    type?: NoteType;
    status?: "pending" | "completed" | "cancelled";
    list?: string | null;
    dueAt?: Date | null;
    priority?: "low" | "normal" | "high" | null;
  },
) {
  const updated = await updateNote(noteId, {
    ...data,
    list: data.list?.toLowerCase().trim() ?? data.list,
  });

  return updated;
}
