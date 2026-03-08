import type { Source } from "@repo/core";

export type ToolContext = {
  userId: string;
  rawInput: string;
  source: Source;
  timezone: string;
};

export type ToolResult = {
  success: boolean;
  data?: unknown;
  error?: string;
};
