import { generateEmbedding } from "@repo/ai";
import { updateEmbedding } from "@repo/db";
import { inngest } from "./client";

// ============================================================
// GENERATE EMBEDDING (event-driven)
// ============================================================
// Fires when a note is created or edited.
// Generates a vector embedding from the summary and saves it to the DB.
// Async so the user doesn't wait for it during capture.

const generateEmbeddingFn = inngest.createFunction(
  { id: "generate-embedding" },
  [{ event: "note/created" }, { event: "note/updated" }],
  async ({ event }) => {
    const { noteId, summary } = event.data;

    const embedding = await generateEmbedding(summary);
    await updateEmbedding(noteId, embedding);

    return { noteId, dimensions: embedding.length };
  },
);

// All functions as an array — this is what Inngest's serve() expects.
export const functions = [generateEmbeddingFn];
