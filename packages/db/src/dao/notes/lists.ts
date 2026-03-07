import { eq, and, sql } from "drizzle-orm";
import { db } from "../../client";
import { notes } from "../../models";

export async function getDistinctLists(userId: string) {
  const result = await db
    .selectDistinct({ list: notes.list })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        eq(notes.type, "todo"),
        sql`${notes.list} IS NOT NULL`,
      ),
    );

  return result.map((r) => r.list!);
}
