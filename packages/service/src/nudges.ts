import { detectCommitment } from "@repo/ai";
import {
  getStaleUnprocessedDumps,
  getExpiredSnoozes,
  updateNudgeStatus,
} from "@repo/db";

// ============================================================
// STALE COMMITMENT SCAN
// ============================================================
// Called by a daily cron job. Finds old dumps that haven't been checked,
// asks the LLM if they contain implicit commitments, and flags them.

export async function scanForStaleCommitments() {
  const staleDumps = await getStaleUnprocessedDumps(5);
  const flagged = [];

  for (const dump of staleDumps) {
    const result = await detectCommitment(
      dump.summary ?? dump.rawInput,
      dump.rawInput,
    );

    if (result.hasCommitment) {
      await updateNudgeStatus(dump.id, "pending");
      flagged.push({ note: dump, reason: result.reason });
    } else {
      // Mark as dismissed so we never check again
      await updateNudgeStatus(dump.id, "dismissed");
    }
  }

  return flagged;
}

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
