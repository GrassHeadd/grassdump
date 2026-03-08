import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { resolveDateExpression } from "@repo/core";
import { updateNote } from "@repo/db";
import type { ToolContext, ToolResult } from "./context";

export const schema: ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_note",
    description:
      "Update an existing note/todo. Use when the user is referencing something they already saved and wants to change it (reschedule, rename, reprioritize, etc).",
    parameters: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "The ID of the note to update.",
        },
        summary: {
          type: "string",
          description: "New summary, if changing.",
        },
        dueExpression: {
          type: "string",
          description: "New due date expression, if changing.",
        },
        list: {
          type: "string",
          description: "New list/category, if changing.",
        },
        priority: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "New priority, if changing.",
        },
        status: {
          type: "string",
          enum: ["pending", "completed", "cancelled"],
          description: "New status, if changing.",
        },
        reminderText: {
          type: "string",
          description: "New reminder text if adding/changing a due date.",
        },
      },
      required: ["noteId"],
    },
  },
};

export async function execute(
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const noteId = args.noteId as string;
  const updates: Record<string, unknown> = {};

  if (args.summary) updates.summary = args.summary;
  if (args.list) updates.list = (args.list as string).toLowerCase().trim();
  if (args.priority) updates.priority = args.priority;
  if (args.status) updates.status = args.status;
  if (args.reminderText) updates.reminderText = args.reminderText;

  if (args.dueExpression) {
    updates.dueAt = resolveDateExpression(
      args.dueExpression as string,
      new Date(),
      ctx.timezone,
    );
  }

  const updated = await updateNote(noteId, updates);
  return { success: true, data: updated };
}
