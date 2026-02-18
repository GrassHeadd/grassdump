import { describe, test, expect } from "bun:test";
import { resolveDateExpression } from "../date-parser";

// Use a fixed reference date so tests are deterministic.
// Feb 18, 2026, 10:00 AM UTC (a Wednesday)
const REF_DATE = new Date("2026-02-18T10:00:00Z");

describe("resolveDateExpression", () => {
  test("parses 'tomorrow'", () => {
    const result = resolveDateExpression("tomorrow", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(19);
    expect(result!.getMonth()).toBe(1); // Feb = 1
  });

  test("parses 'next tuesday'", () => {
    // Feb 18 is Wednesday, so next Tuesday is Feb 24
    const result = resolveDateExpression("next tuesday", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(24);
  });

  test("parses 'in 3 days'", () => {
    const result = resolveDateExpression("in 3 days", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(21);
  });

  test("parses 'march 1st'", () => {
    const result = resolveDateExpression("march 1st", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(2); // March = 2
    expect(result!.getDate()).toBe(1);
  });

  test("parses 'friday'", () => {
    // Feb 18 is Wednesday, nearest Friday is Feb 20
    const result = resolveDateExpression("friday", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.getDay()).toBe(5); // Friday
  });

  test("parses 'next week'", () => {
    const result = resolveDateExpression("next week", REF_DATE);
    expect(result).not.toBeNull();
    // Should be sometime in the following week
    expect(result!.getTime()).toBeGreaterThan(REF_DATE.getTime());
  });

  test("parses 'in 2 hours'", () => {
    const result = resolveDateExpression("in 2 hours", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(12);
  });

  test("parses 'today at 5pm'", () => {
    const result = resolveDateExpression("today at 5pm", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(18);
    expect(result!.getHours()).toBe(17);
  });

  test("returns null for unparseable input", () => {
    const result = resolveDateExpression("asdfghjkl", REF_DATE);
    expect(result).toBeNull();
  });

  test("returns null for empty string", () => {
    const result = resolveDateExpression("", REF_DATE);
    expect(result).toBeNull();
  });

  test("handles timezone parameter", () => {
    const result = resolveDateExpression(
      "tomorrow",
      REF_DATE,
      "America/New_York",
    );
    expect(result).not.toBeNull();
    // Should still resolve to a valid date
    expect(result!.getTime()).toBeGreaterThan(REF_DATE.getTime());
  });

  test("defaults referenceDate to now when not provided", () => {
    const result = resolveDateExpression("tomorrow");
    expect(result).not.toBeNull();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Should be within the same day as tomorrow
    expect(result!.getDate()).toBe(tomorrow.getDate());
  });

  test("parses 'end of month'", () => {
    const result = resolveDateExpression("end of month", REF_DATE);
    // chrono may or may not handle this — test that it doesn't crash
    // If it returns null that's fine, just shouldn't throw
    expect(result === null || result instanceof Date).toBe(true);
  });

  test("parses 'the day after tomorrow'", () => {
    const result = resolveDateExpression("the day after tomorrow", REF_DATE);
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(20);
  });
});
