import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { getOpenAI } from "./client";
import { buildAgentSystemPrompt } from "./prompts/agent";

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

type SearchResult = {
  id: string;
  summary: string | null;
  type: string;
  similarity: number;
};

export type Action =
  | { type: "created_todo"; note: Record<string, unknown> }
  | { type: "created_dump"; note: Record<string, unknown> }
  | { type: "updated_note"; note: Record<string, unknown> }
  | { type: "completed_note"; note: Record<string, unknown> }
  | { type: "search_results"; results: SearchResult[] };

export type AgentResult = {
  reply: string;
  actions: Action[];
};

export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

// ============================================================
// TOOL DEFINITIONS
// ============================================================

const tools: ChatCompletionTool[] = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
];

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
      tools,
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
              results: result.data as SearchResult[],
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
