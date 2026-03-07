import { generateEmbedding } from "@repo/ai";
import { updateEmbedding } from "@repo/db";

// Combines AI embedding generation + DB save into one call.
// Used by the jobs layer after note creation/update.

export async function embedNote(noteId: string, summary: string) {
  const embedding = await generateEmbedding(summary);
  await updateEmbedding(noteId, embedding);
}
