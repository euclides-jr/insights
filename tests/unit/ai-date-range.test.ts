import { describe, expect, it } from "vitest";
import { inferQuestionDateRange } from "@/lib/ai/date-range";

describe("inferQuestionDateRange", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");

  it("defaults to the last 7 days when no range is mentioned", () => {
    const range = inferQuestionDateRange("How many signups happened?", now);

    expect(range.startDate).toBe("2026-03-21T12:00:00.000Z");
    expect(range.endDate).toBe("2026-03-28T12:00:00.000Z");
  });

  it("uses the last month when the prompt asks for it", () => {
    const range = inferQuestionDateRange(
      "Show mobile subscriptions by billing period for the last month",
      now,
    );

    expect(range.startDate).toBe("2026-02-26T12:00:00.000Z");
    expect(range.endDate).toBe("2026-03-28T12:00:00.000Z");
  });

  it("supports explicit day counts", () => {
    const range = inferQuestionDateRange(
      "How many purchases happened in the last 30 days?",
      now,
    );

    expect(range.startDate).toBe("2026-02-26T12:00:00.000Z");
    expect(range.endDate).toBe("2026-03-28T12:00:00.000Z");
  });
});
