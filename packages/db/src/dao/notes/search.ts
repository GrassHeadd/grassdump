import { sql } from "drizzle-orm";
import { db } from "../../client";

export async function semanticSearch(
  userId: string,
  queryEmbedding: number[],
  limit: number = 10,
) {
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const results = await db.execute(sql`
    SELECT id, summary, type, status, due_at, created_at,
           1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM notes
    WHERE user_id = ${userId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `);

  return results as unknown as Record<string, unknown>[];
}

export async function updateEmbedding(noteId: string, embedding: number[]) {
  const vectorStr = `[${embedding.join(",")}]`;

  await db.execute(sql`
    UPDATE notes
    SET embedding = ${vectorStr}::vector, updated_at = now()
    WHERE id = ${noteId}
  `);
}
