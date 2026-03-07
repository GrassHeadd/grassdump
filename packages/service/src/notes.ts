import {
  classifyAndParse,
  reparseAsType,
  generateEmbedding,
  runAgentLoop,
} from "@repo/ai";
import type { AgentResult, ToolExecutor } from "@repo/ai";
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
  getRecentNotes,
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

export { getDumpFeed, getDistinctLists, getOverdueTodos, updateNote };

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

// ============================================================
// AGENT-BASED MESSAGE PROCESSING
// ============================================================
// Replaces captureNote for the Telegram flow.
// The agent sees recent notes as context, decides what to do
// (create, update, search, complete), and writes a casual reply.

export async function processMessage(
  userId: string,
  rawInput: string,
  source: Source,
  timezone: string,
): Promise<AgentResult> {
  const recentNotes = await getRecentNotes(userId, 20);

  const notesContext = recentNotes.map((n) => ({
    id: n.id,
    summary: n.summary,
    type: n.type,
    status: n.status,
    dueAt: n.dueAt,
    list: n.list,
    priority: n.priority,
  }));

  const executeTool: ToolExecutor = async (name, args) => {
    try {
      switch (name) {
        case "create_todo": {
          const dueAt = args.dueExpression
            ? resolveDateExpression(
                args.dueExpression as string,
                new Date(),
                timezone,
              )
            : null;

          const note = await createNote({
            userId,
            rawInput,
            summary: (args.summary as string) ?? null,
            type: "todo",
            source,
            status: "pending",
            list: args.list ? (args.list as string).toLowerCase().trim() : null,
            dueAt,
            priority: (args.priority as "low" | "normal" | "high") ?? "normal",
            reminderText: (args.reminderText as string) ?? null,
          });

          return { success: true, data: note };
        }

        case "create_dump": {
          const note = await createNote({
            userId,
            rawInput,
            summary: (args.summary as string) ?? null,
            type: "dump",
            source,
            status: null,
            list: null,
            dueAt: null,
            priority: null,
          });

          return { success: true, data: note };
        }

        case "update_note": {
          const noteId = args.noteId as string;
          const updates: Record<string, unknown> = {};

          if (args.summary) updates.summary = args.summary;
          if (args.list)
            updates.list = (args.list as string).toLowerCase().trim();
          if (args.priority) updates.priority = args.priority;
          if (args.status) updates.status = args.status;
          if (args.reminderText) updates.reminderText = args.reminderText;

          if (args.dueExpression) {
            updates.dueAt = resolveDateExpression(
              args.dueExpression as string,
              new Date(),
              timezone,
            );
          }

          const updated = await updateNote(noteId, updates);
          return { success: true, data: updated };
        }

        case "complete_note": {
          const completed = await dbComplete(args.noteId as string);
          return { success: true, data: completed };
        }

        case "search": {
          const queryEmbedding = await generateEmbedding(args.query as string);
          const results = await dbSearch(userId, queryEmbedding, 5);
          return { success: true, data: results };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      console.error(`[agent] tool ${name} failed:`, err);
      return { success: false, error: String(err) };
    }
  };

  return runAgentLoop(rawInput, timezone, notesContext, executeTool);
}
