import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { resolveDateExpression } from "@repo/core";
import { createNote } from "@repo/db";
import type { ToolContext, ToolResult } from "./context";

export const schema: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_todo",
    description:
      "Create a new todo/task. Use when the user wants to remember to DO something.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Clean, concise summary of the task. Keep their tone.",
        },
        dueExpression: {
          type: "string",
          description:
            "Natural language date/time expression exactly as implied (e.g. 'tomorrow', 'in 2 hours', 'next friday at 3pm'). Null if no time mentioned.",
        },
        list: {
          type: "string",
          description:
            "Category if obvious (e.g. 'groceries', 'shopping'). Null if unclear.",
        },
        priority: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "Priority level. Default normal.",
        },
        reminderText: {
          type: "string",
          description:
            "A short, fun, casual reminder message to send later when the todo is due. Write it like a friend nudging them. Only include if there's a due date.",
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
  const dueAt = args.dueExpression
    ? resolveDateExpression(
        args.dueExpression as string,
        new Date(),
        ctx.timezone,
      )
    : null;

  const note = await createNote({
    userId: ctx.userId,
    rawInput: ctx.rawInput,
    summary: (args.summary as string) ?? null,
    type: "todo",
    source: ctx.source,
    status: "pending",
    list: args.list ? (args.list as string).toLowerCase().trim() : null,
    dueAt,
    priority: (args.priority as "low" | "normal" | "high") ?? "normal",
    reminderText: (args.reminderText as string) ?? null,
  });

  return { success: true, data: note };
}
