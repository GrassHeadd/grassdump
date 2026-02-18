import { getOpenAI } from "./client";

// Generates a 1536-dimension embedding vector from text.
// Used for semantic search — similar meanings produce similar vectors,
// so "buy groceries" and "get food from the store" end up close together.

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0]!.embedding;
}
