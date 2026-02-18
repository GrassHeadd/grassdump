import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { getOpenAI } from "./client";

const commitmentResultSchema = z.object({
  hasCommitment: z.boolean(),
  reason: z.string(),
});

export type CommitmentResult = z.infer<typeof commitmentResultSchema>;

const SYSTEM_PROMPT = `You analyze notes/thoughts that a user dumped. Your job is to determine if the note contains an implicit commitment — something the user should follow up on or act on, but didn't explicitly create a task for.

Examples of implicit commitments:
- "that recruiter said follow up next week" → YES, they should follow up
- "landlord wants me to sign the lease by Friday" → YES, deadline to act on
- "told Sarah I'd send her the photos" → YES, promise to fulfill

Examples of NOT commitments:
- "wifi password at the office is XYZ123" → NO, just information
- "interesting article about postgres" → NO, just a thought
- "had a great coffee today" → NO, just a note

Be conservative. Only flag things where there's a clear action the user should take.`;

export async function detectCommitment(
  summary: string,
  rawInput: string,
): Promise<CommitmentResult> {
  const completion = await getOpenAI().chat.completions.parse({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Note summary: ${summary}\n\nOriginal input: ${rawInput}`,
      },
    ],
    response_format: zodResponseFormat(commitmentResultSchema, "commitment"),
  });

  const parsed = completion.choices[0]!.message.parsed;

  if (!parsed) {
    throw new Error("Failed to parse commitment detection response");
  }

  return parsed;
}
