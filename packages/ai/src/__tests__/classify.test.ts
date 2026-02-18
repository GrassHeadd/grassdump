import { describe, test, expect, mock, beforeEach } from "bun:test";

const mockParse = mock(() =>
  Promise.resolve({
    choices: [
      {
        message: {
          parsed: {
            type: "todo",
            items: [
              {
                summary: "Call mom",
                dueExpression: "next tuesday",
                list: null,
                priority: "normal",
              },
            ],
          },
        },
      },
    ],
  }),
);

mock.module("../client", () => ({
  getOpenAI: () => ({ chat: { completions: { parse: mockParse } } }),
}));

const { classifyAndParse } = await import("../classify");

beforeEach(() => {
  mockParse.mockClear();
});

describe("classifyAndParse", () => {
  test("returns classification from LLM response", async () => {
    const result = await classifyAndParse("call mom tuesday");

    expect(result.type).toBe("todo");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.summary).toBe("Call mom");
    expect(result.items[0]!.dueExpression).toBe("next tuesday");
  });

  test("calls OpenAI with correct params", async () => {
    await classifyAndParse("buy eggs");

    expect(mockParse).toHaveBeenCalledTimes(1);
    const callArgs = mockParse.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs.model).toBe("gpt-5.2");
    const messages = callArgs.messages as Array<{
      role: string;
      content: string;
    }>;
    expect(messages[1]!.content).toBe("buy eggs");
  });

  test("handles multi-intent responses", async () => {
    mockParse.mockReturnValueOnce(
      Promise.resolve({
        choices: [
          {
            message: {
              parsed: {
                type: "todo",
                items: [
                  {
                    summary: "Call mom",
                    dueExpression: "tuesday",
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
              },
            },
          },
        ],
      }),
    );

    const result = await classifyAndParse("call mom tuesday and buy eggs");
    expect(result.items).toHaveLength(2);
    expect(result.items[1]!.list).toBe("groceries");
  });

  test("handles dump classification", async () => {
    mockParse.mockReturnValueOnce(
      Promise.resolve({
        choices: [
          {
            message: {
              parsed: {
                type: "dump",
                items: [
                  {
                    summary: "WiFi password is XYZ123",
                    dueExpression: null,
                    list: null,
                    priority: null,
                  },
                ],
              },
            },
          },
        ],
      }),
    );

    const result = await classifyAndParse("wifi password is XYZ123");
    expect(result.type).toBe("dump");
  });

  test("throws when parsed is null", async () => {
    mockParse.mockReturnValueOnce(
      Promise.resolve({ choices: [{ message: { parsed: null } }] }),
    );

    expect(classifyAndParse("test")).rejects.toThrow(
      "Failed to parse AI classification response",
    );
  });
});
