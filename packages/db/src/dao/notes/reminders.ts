import { eq, and, lte, gte, isNull, asc } from "drizzle-orm";
import { db } from "../../client";
import { notes, users } from "../../models";
import { updateNote } from "./crud";

export async function getTodosDueSoon(withinHours: number = 24) {
  const now = new Date();
  const soon = new Date();
  soon.setHours(soon.getHours() + withinHours);

  return db
    .select({
      note: notes,
      user: users,
    })
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(
      and(
        eq(notes.type, "todo"),
        eq(notes.status, "pending"),
        gte(notes.dueAt, now),
        lte(notes.dueAt, soon),
      ),
    )
    .orderBy(asc(notes.dueAt));
}

export async function getTodosJustDue() {
  const now = new Date();

  return db
    .select({
      note: notes,
      user: users,
    })
    .from(notes)
    .innerJoin(users, eq(notes.userId, users.id))
    .where(
      and(
        eq(notes.type, "todo"),
        eq(notes.status, "pending"),
        lte(notes.dueAt, now),
        isNull(notes.reminderSentAt),
      ),
    );
}

export async function markReminderSent(noteId: string) {
  return updateNote(noteId, { reminderSentAt: new Date() });
}
