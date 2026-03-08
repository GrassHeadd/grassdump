import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { generateEmbedding } from "../embeddings";
import { semanticSearch } from "@repo/db";
import type { ToolContext, ToolResult } from "./context";

export const schema: ChatCompletionTool = {
  type: "function",
  function: {
    name: "search",
    description:
      "Search through the user's saved notes and todos. Use when the user is asking about something they saved before, or asking a question that their notes might answer.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for.",
        },
      },
      required: ["query"],
    },
  },
};

export async function execute(
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const queryEmbedding = await generateEmbedding(args.query as string);
  const results = await semanticSearch(ctx.userId, queryEmbedding, 5);
  return { success: true, data: results };
}
