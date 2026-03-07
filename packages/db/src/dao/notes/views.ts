import { eq, and, lte, gte, desc, asc } from "drizzle-orm";
import { db } from "../../client";
import { notes } from "../../models";

export async function getRecentNotes(userId: string, limit: number = 20) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.createdAt))
    .limit(limit);
}

export async function getTodosDueToday(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.type, "todo"),
        eq(notes.status, "pending"),
        gte(notes.dueAt, startOfDay),
        lte(notes.dueAt, endOfDay),
      ),
    )
    .orderBy(asc(notes.dueAt));
}

export async function getOverdueTodos(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.type, "todo"),
        eq(notes.status, "pending"),
        lte(notes.dueAt, startOfDay),
      ),
    )
    .orderBy(asc(notes.dueAt));
}

export async function getTodosUpcoming(userId: string, days: number = 3) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  futureDate.setHours(23, 59, 59, 999);

  return db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.type, "todo"),
        eq(notes.status, "pending"),
        gte(notes.dueAt, endOfToday),
        lte(notes.dueAt, futureDate),
      ),
    )
    .orderBy(asc(notes.dueAt));
}

export async function getDumpFeed(
  userId: string,
  limit: number = 20,
  offset: number = 0,
) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.type, "dump")))
    .orderBy(desc(notes.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getRecentDumps(userId: string, limit: number = 5) {
  return getDumpFeed(userId, limit, 0);
}
