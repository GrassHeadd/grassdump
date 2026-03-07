import { eq } from "drizzle-orm";
import { db } from "../client";
import { users } from "../models";

export async function getOrCreateUserByTelegramId(telegramId: number) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);

  if (existing.length > 0) return existing[0]!;

  const created = await db.insert(users).values({ telegramId }).returning();

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
