import {
  pgTable,
  uuid,
  text,
  bigint,
  boolean,
  time,
  timestamp,
} from "drizzle-orm/pg-core";

// Each user has an optional telegram_id (for the bot) and
// optional email (for the app). MVP is single-user but the
// schema supports multiple users from the start.

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).unique(),
  email: text("email").unique(),
  timezone: text("timezone").notNull().default("UTC"),
  digestEnabled: boolean("digest_enabled").notNull().default(true),
  digestTime: time("digest_time").notNull().default("08:00"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
