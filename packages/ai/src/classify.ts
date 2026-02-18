import { zodResponseFormat } from "openai/helpers/zod";
import { classificationResponseSchema } from "@repo/core";
import type { ClassificationResponse } from "@repo/core";
import { getOpenAI } from "./client";

const SYSTEM_PROMPT = `You are a personal task assistant. The user will send you a raw thought, reminder, or note.

Your job:
1. Decide if this is a "todo" (something actionable) or a "dump" (just information to remember).
2. Extract one or more items from the input. Multi-intent inputs like "call mom tuesday and buy eggs" become two separate items.

For todos, extract:
- summary: a clean, concise version of the task
- dueExpression: the raw date/time phrase if mentioned (e.g. "next tuesday", "in 3 days", "march 1st"). Return null if no date is mentioned. Do NOT resolve to an actual date — just extract the phrase.
- list: a category if obvious (e.g. "buy eggs" → "groceries", "call dentist" → null). Use lowercase. Return null if no clear category.
- priority: "low", "normal", or "high". Default to "normal" unless the input implies urgency.

For dumps, extract:
- summary: a clean, concise version of the information
- dueExpression: null
- list: null
- priority: null

Rules:
- Lean toward "todo" if it's ambiguous but actionable
- Keep summaries short and natural — don't over-formalize
- If the user says "remind me", it's a todo
- Grocery/shopping items go in the "groceries" list`;

export async function classifyAndParse(
  rawInput: string,
): Promise<ClassificationResponse> {
  const completion = await getOpenAI().chat.completions.parse({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: rawInput },
    ],
    response_format: zodResponseFormat(
      classificationResponseSchema,
      "classification",
    ),
  });

  const parsed = completion.choices[0]!.message.parsed;

  if (!parsed) {
    throw new Error("Failed to parse AI classification response");
  }

  return parsed;
}
