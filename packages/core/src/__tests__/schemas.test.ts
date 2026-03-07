import { describe, test, expect } from "bun:test";
import {
  noteTypeSchema,
  sourceSchema,
  statusSchema,
  prioritySchema,
  nudgeStatusSchema,
  noteSchema,
  userSchema,
  createNoteInputSchema,
  updateNoteInputSchema,
} from "../types";

// ============================================================
// ENUM SCHEMAS
// ============================================================

describe("noteTypeSchema", () => {
  test("accepts 'todo'", () => {
    expect(noteTypeSchema.parse("todo")).toBe("todo");
  });

  test("accepts 'dump'", () => {
    expect(noteTypeSchema.parse("dump")).toBe("dump");
  });

  test("rejects invalid type", () => {
    expect(() => noteTypeSchema.parse("reminder")).toThrow();
  });

  test("rejects empty string", () => {
    expect(() => noteTypeSchema.parse("")).toThrow();
  });

  test("rejects number", () => {
    expect(() => noteTypeSchema.parse(1)).toThrow();
  });
});

describe("sourceSchema", () => {
  test.each(["telegram", "mobile", "web", "desktop", "voice"])(
    "accepts '%s'",
    (source) => {
      expect(sourceSchema.parse(source)).toBe(source);
    },
  );

  test("rejects 'email'", () => {
    expect(() => sourceSchema.parse("email")).toThrow();
  });

  test("rejects null", () => {
    expect(() => sourceSchema.parse(null)).toThrow();
  });
});

describe("statusSchema", () => {
  test.each(["pending", "completed", "cancelled"])("accepts '%s'", (s) => {
    expect(statusSchema.parse(s)).toBe(s);
  });

  test("rejects 'done'", () => {
    expect(() => statusSchema.parse("done")).toThrow();
  });
});

describe("prioritySchema", () => {
  test.each(["low", "normal", "high"])("accepts '%s'", (p) => {
    expect(prioritySchema.parse(p)).toBe(p);
  });

  test("rejects 'urgent'", () => {
    expect(() => prioritySchema.parse("urgent")).toThrow();
  });
});

describe("nudgeStatusSchema", () => {
  test.each(["pending", "sent", "actioned", "snoozed", "dismissed"])(
    "accepts '%s'",
    (s) => {
      expect(nudgeStatusSchema.parse(s)).toBe(s);
    },
  );

  test("rejects 'ignored'", () => {
    expect(() => nudgeStatusSchema.parse("ignored")).toThrow();
  });
});

// ============================================================
// USER SCHEMA
// ============================================================

describe("userSchema", () => {
  const validUser = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    telegramId: 12345,
    email: "jj@example.com",
    timezone: "America/New_York",
    digestEnabled: true,
    digestTime: "08:00",
    createdAt: new Date(),
  };

  test("accepts a valid user", () => {
    const result = userSchema.parse(validUser);
    expect(result.id).toBe(validUser.id);
    expect(result.email).toBe("jj@example.com");
  });

  test("accepts null telegramId", () => {
    const result = userSchema.parse({ ...validUser, telegramId: null });
    expect(result.telegramId).toBeNull();
  });

  test("accepts null email", () => {
    const result = userSchema.parse({ ...validUser, email: null });
    expect(result.email).toBeNull();
  });

  test("defaults timezone to UTC", () => {
    const { timezone, ...noTz } = validUser;
    const result = userSchema.parse(noTz);
    expect(result.timezone).toBe("UTC");
  });

  test("defaults digestEnabled to true", () => {
    const { digestEnabled, ...noDigest } = validUser;
    const result = userSchema.parse(noDigest);
    expect(result.digestEnabled).toBe(true);
  });

  test("rejects invalid email", () => {
    expect(() =>
      userSchema.parse({ ...validUser, email: "not-an-email" }),
    ).toThrow();
  });

  test("rejects invalid uuid", () => {
    expect(() =>
      userSchema.parse({ ...validUser, id: "not-a-uuid" }),
    ).toThrow();
  });

  test("rejects non-integer telegramId", () => {
    expect(() => userSchema.parse({ ...validUser, telegramId: 1.5 })).toThrow();
  });
});

// ============================================================
// NOTE SCHEMA
// ============================================================

describe("noteSchema", () => {
  const now = new Date();
  const validTodo = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: "660e8400-e29b-41d4-a716-446655440000",
    rawInput: "call mom tuesday",
    summary: "Call mom",
    type: "todo" as const,
    source: "telegram" as const,
    status: "pending" as const,
    list: null,
    dueAt: now,
    priority: "normal" as const,
    completedAt: null,
    nudgeStatus: null,
    nudgedAt: null,
    snoozeUntil: null,
    telegramMessageId: null,
    createdAt: now,
    updatedAt: now,
  };

  const validDump = {
    ...validTodo,
    type: "dump" as const,
    summary: "WiFi password is XYZ123",
    status: null,
    dueAt: null,
    priority: null,
  };

  test("accepts a valid todo", () => {
    const result = noteSchema.parse(validTodo);
    expect(result.type).toBe("todo");
    expect(result.status).toBe("pending");
  });

  test("accepts a valid dump", () => {
    const result = noteSchema.parse(validDump);
    expect(result.type).toBe("dump");
    expect(result.status).toBeNull();
  });

  test("accepts nullable todo fields for dumps", () => {
    const result = noteSchema.parse(validDump);
    expect(result.dueAt).toBeNull();
    expect(result.priority).toBeNull();
    expect(result.list).toBeNull();
  });

  test("accepts telegramMessageId", () => {
    const result = noteSchema.parse({
      ...validTodo,
      telegramMessageId: 999999,
    });
    expect(result.telegramMessageId).toBe(999999);
  });

  test("accepts all nudge statuses", () => {
    for (const status of [
      "pending",
      "sent",
      "actioned",
      "snoozed",
      "dismissed",
    ] as const) {
      const result = noteSchema.parse({ ...validTodo, nudgeStatus: status });
      expect(result.nudgeStatus).toBe(status);
    }
  });

  test("rejects missing rawInput", () => {
    const { rawInput, ...noRaw } = validTodo;
    expect(() => noteSchema.parse(noRaw)).toThrow();
  });

  test("rejects invalid type", () => {
    expect(() => noteSchema.parse({ ...validTodo, type: "note" })).toThrow();
  });

  test("rejects invalid source", () => {
    expect(() => noteSchema.parse({ ...validTodo, source: "sms" })).toThrow();
  });
});

// ============================================================
// INPUT SCHEMAS
// ============================================================

describe("createNoteInputSchema", () => {
  test("accepts valid input", () => {
    const result = createNoteInputSchema.parse({
      rawInput: "buy eggs",
      source: "mobile",
    });
    expect(result.rawInput).toBe("buy eggs");
    expect(result.source).toBe("mobile");
  });

  test("rejects empty rawInput", () => {
    expect(() =>
      createNoteInputSchema.parse({ rawInput: "", source: "mobile" }),
    ).toThrow();
  });

  test("rejects missing source", () => {
    expect(() =>
      createNoteInputSchema.parse({ rawInput: "buy eggs" }),
    ).toThrow();
  });
});

describe("updateNoteInputSchema", () => {
  test("accepts just id", () => {
    const result = updateNoteInputSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.id).toBeDefined();
  });

  test("accepts partial updates", () => {
    const result = updateNoteInputSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      summary: "Updated summary",
      priority: "high",
    });
    expect(result.summary).toBe("Updated summary");
    expect(result.priority).toBe("high");
  });

  test("accepts null for nullable fields", () => {
    const result = updateNoteInputSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      list: null,
      dueAt: null,
      priority: null,
    });
    expect(result.list).toBeNull();
    expect(result.dueAt).toBeNull();
    expect(result.priority).toBeNull();
  });

  test("rejects invalid priority", () => {
    expect(() =>
      updateNoteInputSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        priority: "urgent",
      }),
    ).toThrow();
  });
});
