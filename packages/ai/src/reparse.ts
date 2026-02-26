import { zodResponseFormat } from "openai/helpers/zod";
import { classificationResponseSchema } from "@repo/core";
import type { ClassificationResponse, NoteType } from "@repo/core";
import { getOpenAI } from "./client";

// When the user taps "Actually a task" on a dump (or "Actually a dump" on a todo),
// we re-parse the raw input with the type forced. This isn't a guess —
// it's a full re-parse with explicit instructions to treat it as the forced type.

export async function reparseAsType(
  rawInput: string,
  forcedType: NoteType,
): Promise<ClassificationResponse> {
  const prompt =
    forcedType === "todo"
      ? `The user wants this treated as a todo. Extract the task details: summary (keep it natural, don't over-formalize), due date/time expression exactly as written (e.g. "at 8pm", "next tuesday", "in 3 days" — include times when mentioned), list category (if obvious, lowercase), and priority. Always return type "todo".`
      : `The user wants this treated as a dump (just information to remember). Extract a clean summary that preserves the user's tone. Always return type "dump".`;

  const completion = await getOpenAI().chat.completions.parse({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: rawInput },
    ],
    response_format: zodResponseFormat(
      classificationResponseSchema,
      "classification",
    ),
  });

  const parsed = completion.choices[0]!.message.parsed;

  if (!parsed) {
    throw new Error("Failed to parse AI re-classification response");
  }

  return parsed;
}
