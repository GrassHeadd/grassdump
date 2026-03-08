import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Action, AgentResult, ToolExecutor } from "@repo/core";
import { getOpenAI } from "./client";
import { buildAgentSystemPrompt } from "./prompts/agent";
import { toolSchemas } from "./tools";

// ============================================================
// TYPES
// ============================================================

type NoteContext = {
  id: string;
  summary: string | null;
  type: string;
  status: string | null;
  dueAt: Date | null;
  list: string | null;
  priority: string | null;
};

// ============================================================
// SYSTEM PROMPT
// ============================================================

function buildSystemPrompt(
  now: Date,
  timezone: string,
  recentNotes: NoteContext[],
): string {
  const dayOfWeek = now.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: timezone,
  });
  const date = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  });

  const notesContext =
    recentNotes.length > 0
      ? recentNotes
          .map((n) => {
            let line = `[${n.id}] ${n.type}${n.status ? ` (${n.status})` : ""}: ${n.summary ?? "(no summary)"}`;
            if (n.dueAt) line += ` | due: ${n.dueAt.toISOString()}`;
            if (n.list) line += ` | list: ${n.list}`;
            if (n.priority && n.priority !== "normal")
              line += ` | priority: ${n.priority}`;
            return line;
          })
          .join("\n")
      : "(no recent notes)";

  return buildAgentSystemPrompt({
    dayOfWeek,
    date,
    time,
    timezone,
    notesContext,
  });
}

// ============================================================
// AGENT LOOP
// ============================================================

const MAX_ITERATIONS = 5;

export async function runAgentLoop(
  userMessage: string,
  timezone: string,
  recentNotes: NoteContext[],
  executeTool: ToolExecutor,
): Promise<AgentResult> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSystemPrompt(new Date(), timezone, recentNotes),
    },
    { role: "user", content: userMessage },
  ];

  const actions: Action[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5.4",
      messages,
      tools: toolSchemas,
    });

    const choice = response.choices[0]!;
    const assistantMessage = choice.message;

    // Add the assistant's message to the conversation
    messages.push(assistantMessage);

    // If no tool calls, we're done — the assistant wrote a reply
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return {
        reply: assistantMessage.content ?? "done",
        actions,
      };
    }

    // Execute each tool call and collect results
    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== "function") continue;

      const args = JSON.parse(toolCall.function.arguments) as Record<
        string,
        unknown
      >;
      const result = await executeTool(toolCall.function.name, args);

      // Track actions based on what tool was called
      if (result.success && result.data) {
        switch (toolCall.function.name) {
          case "create_todo":
            actions.push({
              type: "created_todo",
              note: result.data as Record<string, unknown>,
            });
            break;
          case "create_dump":
            actions.push({
              type: "created_dump",
              note: result.data as Record<string, unknown>,
            });
            break;
          case "update_note":
            actions.push({
              type: "updated_note",
              note: result.data as Record<string, unknown>,
            });
            break;
          case "complete_note":
            actions.push({
              type: "completed_note",
              note: result.data as Record<string, unknown>,
            });
            break;
          case "search":
            actions.push({
              type: "search_results",
              results: result.data as Action extends {
                type: "search_results";
                results: infer R;
              }
                ? R
                : never,
            });
            break;
        }
      }

      // Feed result back to the model
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  // If we hit max iterations, return whatever we have
  return {
    reply: "hmm something got stuck, but i saved what i could",
    actions,
  };
}
