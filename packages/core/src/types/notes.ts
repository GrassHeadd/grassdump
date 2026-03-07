import { z } from "zod";

// --- Enum schemas ---
// These match the CHECK constraints in your SQL schema.

export const noteTypeSchema = z.enum(["todo", "dump"]);

export const sourceSchema = z.enum([
  "telegram",
  "mobile",
  "web",
  "desktop",
  "voice",
]);

export const statusSchema = z.enum(["pending", "completed", "cancelled"]);

export const prioritySchema = z.enum(["low", "normal", "high"]);

export const nudgeStatusSchema = z.enum([
  "pending",
  "sent",
  "actioned",
  "snoozed",
  "dismissed",
]);

// --- Note schema ---
// Represents both todos and dumps.
// Todo-specific fields (status, list, dueAt, priority) are nullable —
// they're null for dumps, populated for todos.

export const noteSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  rawInput: z.string(),
  summary: z.string().nullable(),
  type: noteTypeSchema,
  source: sourceSchema,
  status: statusSchema.nullable(),
  list: z.string().nullable(),
  dueAt: z.date().nullable(),
  priority: prioritySchema.nullable(),
  completedAt: z.date().nullable(),
  nudgeStatus: nudgeStatusSchema.nullable(),
  nudgedAt: z.date().nullable(),
  snoozeUntil: z.date().nullable(),
  telegramMessageId: z.number().int().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// --- Inferred types ---

export type NoteType = z.infer<typeof noteTypeSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Status = z.infer<typeof statusSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type NudgeStatus = z.infer<typeof nudgeStatusSchema>;
export type Note = z.infer<typeof noteSchema>;
