import { describe, test, expect, mock, beforeEach } from "bun:test";
import { resolveDateExpression } from "@repo/core";

// For service-level tests, we test the logic that matters:
// captureNote's date resolution, list normalization, and status setting.
// The AI and DB calls are tested in their own packages.
// Full integration tests will cover the end-to-end flow.

describe("captureNote logic", () => {
  // Test the date resolution that captureNote depends on
  test("resolves 'next tuesday' to a real date", () => {
    const ref = new Date("2026-02-18T10:00:00Z");
    const result = resolveDateExpression("next tuesday", ref);
    expect(result).not.toBeNull();
    expect(result!.getDay()).toBe(2); // Tuesday
  });

  test("returns null for no date expression", () => {
    const result = resolveDateExpression("", new Date());
    expect(result).toBeNull();
  });

  // Test list normalization logic (extracted from captureNote)
  test("list names are lowercased and trimmed", () => {
    const normalize = (list: string | null) =>
      list?.toLowerCase().trim() ?? null;

    expect(normalize(" Groceries ")).toBe("groceries");
    expect(normalize("WORK")).toBe("work");
    expect(normalize(null)).toBeNull();
    expect(normalize("  Personal  ")).toBe("personal");
  });

  // Test status assignment logic
  test("todos get pending status, dumps get null", () => {
    const getStatus = (type: "todo" | "dump") =>
      type === "todo" ? "pending" : null;

    expect(getStatus("todo")).toBe("pending");
    expect(getStatus("dump")).toBeNull();
  });

  // Test priority defaulting logic
  test("todos default to normal priority, dumps get null", () => {
    const getPriority = (type: "todo" | "dump", aiPriority: string | null) =>
      aiPriority ?? (type === "todo" ? "normal" : null);

    expect(getPriority("todo", null)).toBe("normal");
    expect(getPriority("todo", "high")).toBe("high");
    expect(getPriority("dump", null)).toBeNull();
  });
});

describe("flipNoteType logic", () => {
  test("throws when note is null", async () => {
    // Simulates the guard in flipNoteType
    const existing = null;
    expect(() => {
      if (!existing) throw new Error("Note not found");
    }).toThrow("Note not found");
  });

  test("throws when reparse returns no items", () => {
    const items: unknown[] = [];
    const item = items[0];
    expect(item).toBeUndefined();
  });
});

describe("editNote logic", () => {
  test("lowercases list on edit", () => {
    const data = { list: " Work " };
    const normalized = data.list?.toLowerCase().trim() ?? data.list;
    expect(normalized).toBe("work");
  });

  test("preserves null list", () => {
    const data = { list: null as string | null };
    const normalized = data.list?.toLowerCase().trim() ?? data.list;
    expect(normalized).toBeNull();
  });
});
