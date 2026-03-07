import { z } from "zod";
import {
  sourceSchema,
  noteTypeSchema,
  statusSchema,
  prioritySchema,
} from "./notes";

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

export type CreateNoteInput = z.infer<typeof createNoteInputSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteInputSchema>;
