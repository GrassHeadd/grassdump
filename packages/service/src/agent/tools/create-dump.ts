import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { createNote } from "@repo/db";
import type { ToolContext, ToolResult } from "./context";

export const schema: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_dump",
    description:
      "Save a piece of information/note/thought. Use when the user wants to REMEMBER something, not do something.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "Clean summary of the information. Keep their tone and key details.",
        },
      },
      required: ["summary"],
    },
  },
};

export async function execute(
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const note = await createNote({
    userId: ctx.userId,
    rawInput: ctx.rawInput,
    summary: (args.summary as string) ?? null,
    type: "dump",
    source: ctx.source,
    status: null,
    list: null,
    dueAt: null,
    priority: null,
  });

  return { success: true, data: note };
}
