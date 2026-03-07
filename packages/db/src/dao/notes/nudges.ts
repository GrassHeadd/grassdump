import { eq, and, lte, isNull, asc } from "drizzle-orm";
import { db } from "../../client";
import { notes } from "../../models";
import { updateNote } from "./crud";

export async function getStaleUnprocessedDumps(daysOld: number = 5) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  return db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.type, "dump"),
        isNull(notes.nudgeStatus),
        lte(notes.createdAt, cutoff),
      ),
    )
    .orderBy(asc(notes.createdAt));
}

export async function updateNudgeStatus(
  noteId: string,
  status: "pending" | "sent" | "actioned" | "snoozed" | "dismissed",
  snoozeUntil?: Date,
) {
  return updateNote(noteId, {
    nudgeStatus: status,
    nudgedAt: new Date(),
    ...(snoozeUntil ? { snoozeUntil } : {}),
  });
}

export async function getExpiredSnoozes() {
  return db
    .select()
    .from(notes)
    .where(
      and(eq(notes.nudgeStatus, "snoozed"), lte(notes.snoozeUntil, new Date())),
    );
}
