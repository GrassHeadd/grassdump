import { eq } from "drizzle-orm";
import { db } from "../../client";
import { notes } from "../../models";

export type CreateNoteRow = typeof notes.$inferInsert;

export async function createNote(data: CreateNoteRow) {
  const created = await db.insert(notes).values(data).returning();
  return created[0]!;
}

export async function getNoteById(noteId: string) {
  const result = await db
    .select()
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);

  return result[0] ?? null;
}

export async function updateNote(
  noteId: string,
  data: Partial<Omit<CreateNoteRow, "id">>,
) {
  const updated = await db
    .update(notes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(notes.id, noteId))
    .returning();

  return updated[0] ?? null;
}

export async function completeNote(noteId: string) {
  return updateNote(noteId, {
    status: "completed",
    completedAt: new Date(),
  });
}

export async function uncompleteNote(noteId: string) {
  return updateNote(noteId, {
    status: "pending",
    completedAt: null,
  });
}

export async function cancelNote(noteId: string) {
  return updateNote(noteId, { status: "cancelled" });
}
