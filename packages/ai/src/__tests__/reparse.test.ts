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
                summary: "Follow up with recruiter",
                dueExpression: "next week",
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

const { reparseAsType } = await import("../reparse");

beforeEach(() => {
  mockParse.mockClear();
});

describe("reparseAsType", () => {
  test("re-parses dump as todo", async () => {
    const result = await reparseAsType(
      "that recruiter said follow up next week",
      "todo",
    );

    expect(result.type).toBe("todo");
    expect(result.items[0]!.summary).toBe("Follow up with recruiter");
  });

  test("re-parses todo as dump", async () => {
    mockParse.mockReturnValueOnce(
      Promise.resolve({
        choices: [
          {
            message: {
              parsed: {
                type: "dump",
                items: [
                  {
                    summary: "Recruiter mentioned following up",
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

    const result = await reparseAsType("follow up with recruiter", "dump");
    expect(result.type).toBe("dump");
  });

  test("uses correct model", async () => {
    await reparseAsType("test input", "todo");

    const callArgs = mockParse.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs.model).toBe("gpt-5.2");
  });

  test("throws when parsed is null", async () => {
    mockParse.mockReturnValueOnce(
      Promise.resolve({ choices: [{ message: { parsed: null } }] }),
    );

    expect(reparseAsType("test", "todo")).rejects.toThrow(
      "Failed to parse AI re-classification response",
    );
  });
});
