// ============================================================
// AGENT TYPES
// ============================================================
// These define the contract for how the agent communicates
// results back to the service layer.

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
