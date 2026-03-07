import {
  getOrCreateUserByTelegramId as dbGetOrCreate,
  findUserById as dbFindById,
  findUserByEmail as dbFindByEmail,
} from "@repo/db";

export async function getOrCreateUserByTelegramId(telegramId: number) {
  return dbGetOrCreate(telegramId);
}

export async function findUserById(userId: string) {
  return dbFindById(userId);
}

export async function findUserByEmail(email: string) {
  return dbFindByEmail(email);
}
