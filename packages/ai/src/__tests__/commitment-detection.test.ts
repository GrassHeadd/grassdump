import { describe, test, expect, mock, beforeEach } from "bun:test";

const mockParse = mock(() =>
  Promise.resolve({
    choices: [
      {
        message: {
          parsed: {
            hasCommitment: true,
            reason: "User promised to follow up with recruiter",
          },
        },
      },
    ],
  }),
);

mock.module("../client", () => ({
  getOpenAI: () => ({ chat: { completions: { parse: mockParse } } }),
}));

const { detectCommitment } = await import("../commitment-detection");

beforeEach(() => {
  mockParse.mockClear();
});

describe("detectCommitment", () => {
  test("detects a commitment", async () => {
    const result = await detectCommitment(
      "TikTok recruiter — follow up next week",
      "that tiktok recruiter said to follow up next week",
    );

    expect(result.hasCommitment).toBe(true);
    expect(result.reason).toContain("follow up");
  });

  test("detects no commitment", async () => {
    mockParse.mockReturnValueOnce(
      Promise.resolve({
        choices: [
          {
            message: {
              parsed: {
                hasCommitment: false,
                reason: "Just storing information",
              },
            },
          },
        ],
      }),
    );

    const result = await detectCommitment(
      "WiFi password is XYZ123",
      "wifi password at the office is XYZ123",
    );
    expect(result.hasCommitment).toBe(false);
  });

  test("sends both summary and rawInput to LLM", async () => {
    await detectCommitment("Summary text", "Raw input text");

    const callArgs = mockParse.mock.calls[0]![0] as Record<string, unknown>;
    const messages = callArgs.messages as Array<{
      role: string;
      content: string;
    }>;
    expect(messages[1]!.content).toContain("Summary text");
    expect(messages[1]!.content).toContain("Raw input text");
  });

  test("uses correct model", async () => {
    await detectCommitment("test", "test");

    const callArgs = mockParse.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs.model).toBe("gpt-5.2");
  });

  test("throws when parsed is null", async () => {
    mockParse.mockReturnValueOnce(
      Promise.resolve({ choices: [{ message: { parsed: null } }] }),
    );

    expect(detectCommitment("test", "test")).rejects.toThrow(
      "Failed to parse commitment detection response",
    );
  });
});
