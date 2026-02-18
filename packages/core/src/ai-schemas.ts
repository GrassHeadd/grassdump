import { z } from "zod";
import { noteTypeSchema, prioritySchema } from "./schemas";

// --- What the LLM returns for each parsed item ---
// "call mom tuesday" → { summary: "Call mom", dueExpression: "next tuesday", list: null, priority: "normal" }
// "wifi password is XYZ123" → { summary: "WiFi password — XYZ123", dueExpression: null, list: null, priority: null }
//
// dueExpression is the RAW string from the LLM ("next tuesday", "in 3 days").
// We don't let the LLM resolve it to an actual date — that's the date parser's job.
// This two-step approach avoids LLM hallucinating wrong dates.

export const parsedItemSchema = z.object({
  summary: z.string(),
  dueExpression: z.string().nullable(),
  list: z.string().nullable(),
  priority: prioritySchema.nullable(),
});

// --- The full classification response ---
// The LLM decides: is this a todo or a dump?
// Then returns one or more parsed items.
//
// "call mom tuesday and buy eggs" →
// { type: "todo", items: [{ summary: "Call mom", ... }, { summary: "Buy eggs", ... }] }
//
// items is always an array, even for single inputs. Keeps the shape consistent
// so the API doesn't need to handle "is this one item or many?" logic.

export const classificationResponseSchema = z.object({
  type: noteTypeSchema,
  items: z.array(parsedItemSchema),
});

// --- Inferred types ---

export type ParsedItem = z.infer<typeof parsedItemSchema>;
export type ClassificationResponse = z.infer<
  typeof classificationResponseSchema
>;
