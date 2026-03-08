import { getExpiredSnoozes, updateNudgeStatus } from "@repo/db";

// ============================================================
// EXPIRED SNOOZES
// ============================================================
// Finds nudges that were snoozed and the snooze period has expired.
// Re-flags them as pending so they get sent again.

export async function reactivateExpiredSnoozes() {
  const expired = await getExpiredSnoozes();

  for (const note of expired) {
    await updateNudgeStatus(note.id, "pending");
  }

  return expired;
}

export { updateNudgeStatus } from "@repo/db";
