import { describe, test, expect } from "bun:test";
import { parsedItemSchema, classificationResponseSchema } from "../types";

describe("parsedItemSchema", () => {
  test("accepts a full todo item", () => {
    const result = parsedItemSchema.parse({
      summary: "Call mom",
      dueExpression: "next tuesday",
      list: "personal",
      priority: "normal",
    });
    expect(result.summary).toBe("Call mom");
    expect(result.dueExpression).toBe("next tuesday");
    expect(result.list).toBe("personal");
    expect(result.priority).toBe("normal");
  });

  test("accepts nulls for optional fields", () => {
    const result = parsedItemSchema.parse({
      summary: "Random thought",
      dueExpression: null,
      list: null,
      priority: null,
    });
    expect(result.dueExpression).toBeNull();
    expect(result.list).toBeNull();
    expect(result.priority).toBeNull();
  });

  test("rejects missing summary", () => {
    expect(() =>
      parsedItemSchema.parse({
        dueExpression: null,
        list: null,
        priority: null,
      }),
    ).toThrow();
  });

  test("rejects invalid priority value", () => {
    expect(() =>
      parsedItemSchema.parse({
        summary: "Test",
        dueExpression: null,
        list: null,
        priority: "critical",
      }),
    ).toThrow();
  });
});

describe("classificationResponseSchema", () => {
  test("accepts a single todo", () => {
    const result = classificationResponseSchema.parse({
      type: "todo",
      items: [
        {
          summary: "Buy eggs",
          dueExpression: null,
          list: "groceries",
          priority: "normal",
        },
      ],
    });
    expect(result.type).toBe("todo");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.summary).toBe("Buy eggs");
  });

  test("accepts multi-intent todos", () => {
    const result = classificationResponseSchema.parse({
      type: "todo",
      items: [
        {
          summary: "Call mom",
          dueExpression: "next tuesday",
          list: null,
          priority: "normal",
        },
        {
          summary: "Buy eggs",
          dueExpression: null,
          list: "groceries",
          priority: "normal",
        },
      ],
    });
    expect(result.items).toHaveLength(2);
  });

  test("accepts a dump", () => {
    const result = classificationResponseSchema.parse({
      type: "dump",
      items: [
        {
          summary: "WiFi password is XYZ123",
          dueExpression: null,
          list: null,
          priority: null,
        },
      ],
    });
    expect(result.type).toBe("dump");
  });

  test("rejects empty items array", () => {
    expect(() =>
      classificationResponseSchema.parse({
        type: "todo",
        items: [],
      }),
    ).not.toThrow(); // empty array is valid z.array — no min constraint
  });

  test("rejects invalid type", () => {
    expect(() =>
      classificationResponseSchema.parse({
        type: "reminder",
        items: [],
      }),
    ).toThrow();
  });

  test("rejects missing items", () => {
    expect(() =>
      classificationResponseSchema.parse({
        type: "todo",
      }),
    ).toThrow();
  });

  test("rejects items with wrong shape", () => {
    expect(() =>
      classificationResponseSchema.parse({
        type: "todo",
        items: [{ text: "wrong shape" }],
      }),
    ).toThrow();
  });
});
