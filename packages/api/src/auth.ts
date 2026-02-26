import { getOrCreateUserByTelegramId } from "@repo/db";

// MVP dev-user auth.
// Looks up the user row by Telegram ID from env.
// When Better Auth is added later, this gets replaced — nothing else changes.

export async function getDevUser() {
  const telegramId = Number(process.env.DEV_USER_TELEGRAM_ID);

  if (!telegramId) {
    throw new Error(
      "DEV_USER_TELEGRAM_ID is not set. Add your Telegram user ID to .env",
    );
  }

  const user = await getOrCreateUserByTelegramId(telegramId);
  return { id: user.id, timezone: user.timezone };
}
