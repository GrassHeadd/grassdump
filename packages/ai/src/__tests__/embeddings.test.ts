import { describe, test, expect, mock, beforeEach } from "bun:test";

const mockCreate = mock(() =>
  Promise.resolve({
    data: [{ embedding: Array(1536).fill(0.1) }],
  }),
);

mock.module("../client", () => ({
  getOpenAI: () => ({ embeddings: { create: mockCreate } }),
}));

const { generateEmbedding } = await import("../embeddings");

beforeEach(() => {
  mockCreate.mockClear();
});

describe("generateEmbedding", () => {
  test("returns a 1536-dimension vector", async () => {
    const result = await generateEmbedding("buy eggs");
    expect(result).toHaveLength(1536);
  });

  test("calls OpenAI with correct model", async () => {
    await generateEmbedding("test text");

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArgs.model).toBe("text-embedding-3-small");
    expect(callArgs.input).toBe("test text");
  });

  test("returns number array", async () => {
    const result = await generateEmbedding("hello");
    expect(result.every((n) => typeof n === "number")).toBe(true);
  });
});
