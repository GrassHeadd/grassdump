import { z } from "zod";

// --- Enum schemas ---
// These match the CHECK constraints in your SQL schema.
// Every time data enters the system, Zod validates it's one of these values.

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

// --- User schema ---

export const userSchema = z.object({
  id: z.string().uuid(),
  telegramId: z.number().int().nullable(),
  email: z.string().email().nullable(),
  timezone: z.string().default("UTC"),
  digestEnabled: z.boolean().default(true),
  digestTime: z.string().default("08:00"), // stored as time string "HH:MM"
  createdAt: z.date(),
});

// --- Note schema ---
// The big one. Represents both todos and dumps.
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

// --- Input schemas ---
// What you send when creating or updating a note.
// You don't send id, createdAt, updatedAt, embedding — those are generated.

export const createNoteInputSchema = z.object({
  rawInput: z.string().min(1),
  source: sourceSchema,
});

export const updateNoteInputSchema = z.object({
  id: z.string().uuid(),
  summary: z.string().optional(),
  type: noteTypeSchema.optional(),
  status: statusSchema.optional(),
  list: z.string().nullable().optional(),
  dueAt: z.date().nullable().optional(),
  priority: prioritySchema.nullable().optional(),
});

// --- Inferred types ---
// These are the TypeScript types extracted from the schemas above.
// Use these in your code instead of manually writing interfaces.

export type NoteType = z.infer<typeof noteTypeSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Status = z.infer<typeof statusSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type NudgeStatus = z.infer<typeof nudgeStatusSchema>;
export type User = z.infer<typeof userSchema>;
export type Note = z.infer<typeof noteSchema>;
export type CreateNoteInput = z.infer<typeof createNoteInputSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteInputSchema>;
