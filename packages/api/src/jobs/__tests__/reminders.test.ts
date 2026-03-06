import { describe, test, expect, mock, beforeEach } from "bun:test";
import { checkAndSendReminders } from "../reminders";

const mockGetTodosJustDue = mock(() => Promise.resolve([] as any[]));
const mockMarkReminderSent = mock(() => Promise.resolve(null as any));
const mockSendMessage = mock(() => Promise.resolve({ ok: true } as any));

const deps = {
  getTodosJustDue: mockGetTodosJustDue,
  markReminderSent: mockMarkReminderSent,
  sendMessage: mockSendMessage,
};

// --- Test data ---
const baseNote = {
  id: "note-1",
  userId: "user-1",
  rawInput: "buy eggs tomorrow",
  summary: "Buy eggs",
  type: "todo" as const,
  source: "telegram" as const,
  status: "pending",
  list: "groceries",
  dueAt: new Date("2026-03-06T09:00:00Z"),
  priority: "normal",
  completedAt: null,
  nudgeStatus: null,
  nudgedAt: null,
  snoozeUntil: null,
  reminderSentAt: null,
  telegramMessageId: null,
  createdAt: new Date("2026-03-05T10:00:00Z"),
  updatedAt: new Date("2026-03-05T10:00:00Z"),
};

const baseUser = {
  id: "user-1",
  telegramId: 123456,
  email: null,
  timezone: "UTC",
  digestEnabled: true,
  digestTime: "08:00",
  createdAt: new Date("2026-01-01"),
};

beforeEach(() => {
  mockGetTodosJustDue.mockClear();
  mockMarkReminderSent.mockClear();
  mockSendMessage.mockClear();
  mockGetTodosJustDue.mockReturnValue(Promise.resolve([]));
});

describe("checkAndSendReminders", () => {
  test("sends nothing when no todos are due", async () => {
    const result = await checkAndSendReminders(deps);

    expect(result).toEqual({ sent: 0, skipped: 0 });
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockMarkReminderSent).not.toHaveBeenCalled();
  });

  test("sends a reminder and marks it sent", async () => {
    mockGetTodosJustDue.mockReturnValueOnce(
      Promise.resolve([{ note: baseNote, user: baseUser }]),
    );

    const result = await checkAndSendReminders(deps);

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0]![0]).toBe(123456);
    expect(mockMarkReminderSent).toHaveBeenCalledWith("note-1");
  });

  test("skips users without telegramId", async () => {
    mockGetTodosJustDue.mockReturnValueOnce(
      Promise.resolve([
        { note: baseNote, user: { ...baseUser, telegramId: null } },
      ]),
    );

    const result = await checkAndSendReminders(deps);

    expect(result).toEqual({ sent: 0, skipped: 1 });
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockMarkReminderSent).not.toHaveBeenCalled();
  });

  test("handles multiple todos for different users", async () => {
    mockGetTodosJustDue.mockReturnValueOnce(
      Promise.resolve([
        { note: baseNote, user: baseUser },
        {
          note: { ...baseNote, id: "note-2", summary: "Call mom" },
          user: { ...baseUser, id: "user-2", telegramId: 789012 },
        },
      ]),
    );

    const result = await checkAndSendReminders(deps);

    expect(result).toEqual({ sent: 2, skipped: 0 });
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(mockMarkReminderSent).toHaveBeenCalledTimes(2);
    expect(mockMarkReminderSent.mock.calls[0]![0]).toBe("note-1");
    expect(mockMarkReminderSent.mock.calls[1]![0]).toBe("note-2");
  });

  test("marks reminder sent even when mixed with skipped users", async () => {
    mockGetTodosJustDue.mockReturnValueOnce(
      Promise.resolve([
        { note: baseNote, user: { ...baseUser, telegramId: null } },
        {
          note: { ...baseNote, id: "note-2" },
          user: { ...baseUser, id: "user-2", telegramId: 789012 },
        },
      ]),
    );

    const result = await checkAndSendReminders(deps);

    expect(result).toEqual({ sent: 1, skipped: 1 });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockMarkReminderSent).toHaveBeenCalledWith("note-2");
  });

  test("reminder message includes the todo summary", async () => {
    mockGetTodosJustDue.mockReturnValueOnce(
      Promise.resolve([{ note: baseNote, user: baseUser }]),
    );

    await checkAndSendReminders(deps);

    const messageText = mockSendMessage.mock.calls[0]![1] as string;
    expect(messageText).toContain("Buy eggs");
  });
});
