import { describe, test, expect, mock, beforeEach } from "bun:test";

// --- Mock AI ---
const mockDetectCommitment = mock(() =>
  Promise.resolve({
    hasCommitment: true,
    reason: "User promised to follow up",
  }),
);

mock.module("@repo/ai", () => ({
  detectCommitment: mockDetectCommitment,
}));

// --- Mock DB ---
const staleDump = {
  id: "dump-1",
  userId: "user-1",
  rawInput: "recruiter said follow up next week",
  summary: "Recruiter — follow up next week",
  type: "dump",
  source: "telegram",
  status: null,
  list: null,
  dueAt: null,
  priority: null,
  completedAt: null,
  nudgeStatus: null,
  nudgedAt: null,
  snoozeUntil: null,
  telegramMessageId: null,
  createdAt: new Date("2026-02-10"),
  updatedAt: new Date("2026-02-10"),
};

const snoozedNote = {
  ...staleDump,
  id: "dump-2",
  nudgeStatus: "snoozed",
  snoozeUntil: new Date("2026-02-17"),
};

const mockGetStaleUnprocessedDumps = mock(() => Promise.resolve([staleDump]));
const mockGetExpiredSnoozes = mock(() => Promise.resolve([snoozedNote]));
const mockUpdateNudgeStatus = mock(() => Promise.resolve(null));

mock.module("@repo/db", () => ({
  getStaleUnprocessedDumps: mockGetStaleUnprocessedDumps,
  getExpiredSnoozes: mockGetExpiredSnoozes,
  updateNudgeStatus: mockUpdateNudgeStatus,
}));

const { scanForStaleCommitments, reactivateExpiredSnoozes } =
  await import("../nudges");

beforeEach(() => {
  mockDetectCommitment.mockClear();
  mockGetStaleUnprocessedDumps.mockClear();
  mockGetExpiredSnoozes.mockClear();
  mockUpdateNudgeStatus.mockClear();
});

// ============================================================
// scanForStaleCommitments
// ============================================================

describe("scanForStaleCommitments", () => {
  test("finds stale dumps and checks for commitments", async () => {
    const result = await scanForStaleCommitments();

    expect(mockGetStaleUnprocessedDumps).toHaveBeenCalledWith(5);
    expect(mockDetectCommitment).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]!.reason).toContain("follow up");
  });

  test("flags notes with commitments as pending", async () => {
    await scanForStaleCommitments();

    expect(mockUpdateNudgeStatus).toHaveBeenCalledWith("dump-1", "pending");
  });

  test("dismisses notes without commitments", async () => {
    mockDetectCommitment.mockReturnValueOnce(
      Promise.resolve({ hasCommitment: false, reason: "Just information" }),
    );

    const result = await scanForStaleCommitments();

    expect(result).toHaveLength(0);
    expect(mockUpdateNudgeStatus).toHaveBeenCalledWith("dump-1", "dismissed");
  });

  test("handles empty stale dumps", async () => {
    mockGetStaleUnprocessedDumps.mockReturnValueOnce(Promise.resolve([]));

    const result = await scanForStaleCommitments();

    expect(result).toHaveLength(0);
    expect(mockDetectCommitment).not.toHaveBeenCalled();
  });

  test("uses summary for detection when available", async () => {
    await scanForStaleCommitments();

    const args = mockDetectCommitment.mock.calls[0]!;
    expect(args[0]).toBe("Recruiter — follow up next week"); // summary
    expect(args[1]).toBe("recruiter said follow up next week"); // rawInput
  });

  test("falls back to rawInput when summary is null", async () => {
    mockGetStaleUnprocessedDumps.mockReturnValueOnce(
      Promise.resolve([{ ...staleDump, summary: null }]),
    );

    await scanForStaleCommitments();

    const args = mockDetectCommitment.mock.calls[0]!;
    expect(args[0]).toBe("recruiter said follow up next week"); // rawInput used as fallback
  });
});

// ============================================================
// reactivateExpiredSnoozes
// ============================================================

describe("reactivateExpiredSnoozes", () => {
  test("finds expired snoozes and reactivates them", async () => {
    const result = await reactivateExpiredSnoozes();

    expect(mockGetExpiredSnoozes).toHaveBeenCalledTimes(1);
    expect(mockUpdateNudgeStatus).toHaveBeenCalledWith("dump-2", "pending");
    expect(result).toHaveLength(1);
  });

  test("handles no expired snoozes", async () => {
    mockGetExpiredSnoozes.mockReturnValueOnce(Promise.resolve([]));

    const result = await reactivateExpiredSnoozes();

    expect(result).toHaveLength(0);
    expect(mockUpdateNudgeStatus).not.toHaveBeenCalled();
  });
});
