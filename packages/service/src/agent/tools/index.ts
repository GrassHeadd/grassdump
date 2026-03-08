import type { ToolExecutor } from "@repo/core";
import * as createTodo from "./create-todo";
import * as createDump from "./create-dump";
import * as updateNote from "./update-note";
import * as completeNote from "./complete-note";
import * as search from "./search";
import type { ToolContext } from "./context";

const registry = {
  create_todo: createTodo,
  create_dump: createDump,
  update_note: updateNote,
  complete_note: completeNote,
  search: search,
};

export const toolSchemas = Object.values(registry).map((t) => t.schema);

export function buildToolExecutor(ctx: ToolContext): ToolExecutor {
  return async (name, args) => {
    const tool = registry[name as keyof typeof registry];
    if (!tool) return { success: false, error: `Unknown tool: ${name}` };

    try {
      return await tool.execute(ctx, args);
    } catch (err) {
      console.error(`[agent] tool ${name} failed:`, err);
      return { success: false, error: String(err) };
    }
  };
}
