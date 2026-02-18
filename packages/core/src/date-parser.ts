import * as chrono from "chrono-node";

// Turns a natural language date string into an actual Date.
// "next tuesday", "in 3 days", "march 1st" → Date object
//
// referenceDate: the "now" to calculate from (defaults to current time)
// timezone: the user's timezone (e.g. "America/New_York") so "tomorrow" means
//           tomorrow for THEM, not for the server sitting in some data center.
//
// Returns null if chrono can't parse it — which is fine,
// it just means the todo gets saved without a due date.

export function resolveDateExpression(
  expression: string,
  referenceDate: Date = new Date(),
  timezone?: string,
): Date | null {
  const result = chrono.parseDate(expression, {
    instant: referenceDate,
    timezone,
  });

  return result ?? null;
}
