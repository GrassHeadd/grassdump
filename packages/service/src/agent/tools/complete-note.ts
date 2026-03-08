import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { completeNote } from "@repo/db";
import type { ToolResult } from "./context";

export const schema: ChatCompletionTool = {
  type: "function",
  function: {
    name: "complete_note",
    description:
      "Mark a todo as done. Use when the user says they finished something or wants to cancel/kill a task.",
    parameters: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "The ID of the note to complete.",
        },
      },
      required: ["noteId"],
    },
  },
};

export async function execute(
  _ctx: unknown,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const completed = await completeNote(args.noteId as string);
  return { success: true, data: completed };
}
