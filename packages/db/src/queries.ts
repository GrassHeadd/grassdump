import { eq, and, lte, gte, isNull, desc, sql, asc } from "drizzle-orm";
import { db } from "./client";
import { users, notes } from "./schema";

// ============================================================
// USER QUERIES
// ============================================================

export async function getOrCreateUserByTelegramId(telegramId: number) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  if (existing.length > 0) return existing[0]!;

  const created = await db
    .insert(users)
    .values({ telegramId })
    .returning();

  return created[0]!;
}

export async function findUserById(userId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0] ?? null;
}

export async function findUserByEmail(email: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result[0] ?? null;
}

// ============================================================
// NOTE CRUD
// ============================================================

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

// ============================================================
// TODO VIEWS
// ============================================================

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

// ============================================================
// DUMP VIEWS
// ============================================================

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

// ============================================================
// ACTIONS
// ============================================================

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

// ============================================================
// SEARCH (pgvector semantic search)
// ============================================================

export async function semanticSearch(
  userId: string,
  queryEmbedding: number[],
  limit: number = 10,
) {
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const results = await db.execute(sql`
    SELECT id, summary, type, status, due_at, created_at,
           1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM notes
    WHERE user_id = ${userId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `);

  return results.rows;
}

// ============================================================
// NUDGES (stale commitment detection)
// ============================================================

export async function getStaleUnprocessedDumps(daysOld: number = 5) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  return db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.type, "dump"),
        isNull(notes.nudgeStatus),
        lte(notes.createdAt, cutoff),
      ),
    )
    .orderBy(asc(notes.createdAt));
}

export async function updateNudgeStatus(
  noteId: string,
  status: "pending" | "sent" | "actioned" | "snoozed" | "dismissed",
  snoozeUntil?: Date,
) {
  return updateNote(noteId, {
    nudgeStatus: status,
    nudgedAt: new Date(),
    ...(snoozeUntil ? { snoozeUntil } : {}),
  });
}

export async function getExpiredSnoozes() {
  return db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.nudgeStatus, "snoozed"),
        lte(notes.snoozeUntil, new Date()),
      ),
    );
}

// ============================================================
// EMBEDDINGS
// ============================================================

export async function updateEmbedding(noteId: string, embedding: number[]) {
  const vectorStr = `[${embedding.join(",")}]`;

  await db.execute(sql`
    UPDATE notes
    SET embedding = ${vectorStr}::vector, updated_at = now()
    WHERE id = ${noteId}
  `);
}

// ============================================================
// LISTS
// ============================================================

export async function getDistinctLists(userId: string) {
  const result = await db
    .selectDistinct({ list: notes.list })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.type, "todo"),
        sql`${notes.list} IS NOT NULL`,
      ),
    );

  return result.map((r) => r.list!);
}

// ============================================================
// REMINDERS (for the daily cron)
// ============================================================

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
