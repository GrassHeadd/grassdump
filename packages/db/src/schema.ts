import {
  pgTable,
  uuid,
  text,
  bigint,
  boolean,
  time,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ============================================================
// USERS TABLE
// ============================================================
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

// ============================================================
// NOTES TABLE
// ============================================================
// The big one. Holds both todos and dumps in one table.
// Todo-specific columns (status, list, dueAt, priority) are
// nullable — they're null for dumps, populated for todos.
//
// The embedding column is added via raw SQL migration because
// pgvector's vector type needs the extension enabled first.

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    rawInput: text("raw_input").notNull(),
    summary: text("summary"),
    type: text("type").notNull(), // 'todo' | 'dump'
    source: text("source").notNull(), // 'telegram' | 'mobile' | 'web' | 'desktop' | 'voice'
    status: text("status"), // 'pending' | 'completed' | 'cancelled' (null for dumps)
    list: text("list"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    priority: text("priority"), // 'low' | 'normal' | 'high' (null for dumps)
    completedAt: timestamp("completed_at", { withTimezone: true }),
    nudgeStatus: text("nudge_status"), // 'pending' | 'sent' | 'actioned' | 'snoozed' | 'dismissed'
    nudgedAt: timestamp("nudged_at", { withTimezone: true }),
    snoozeUntil: timestamp("snooze_until", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    telegramMessageId: bigint("telegram_message_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Today view: pending todos sorted by due date
    index("idx_notes_user_status_due").on(
      table.userId,
      table.status,
      table.dueAt,
    ),

    // Dump feed: chronological per user
    index("idx_notes_user_created").on(table.userId, table.createdAt),
  ],
);
