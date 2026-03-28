import { describe, expect, it, vi } from "vitest";
import {
  inferQuestionDateRange,
  resolveQuestionDateRange,
} from "@/lib/ai/date-range";

describe("resolveQuestionDateRange", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");

  it("defaults to the last 7 days when no range is mentioned", async () => {
    const range = await resolveQuestionDateRange(
      "How many signups happened?",
      { now },
    );

    expect(range.startDate).toBe("2026-03-21T12:00:00.000Z");
    expect(range.endDate).toBe("2026-03-28T12:00:00.000Z");
    expect(range.source).toBe("default");
    expect(range.confidence).toBe("low");
  });

  it("uses deterministic parsing for the last month", async () => {
    const range = await resolveQuestionDateRange(
      "Show mobile subscriptions by billing period for the last month",
      { now },
    );

    expect(range.startDate).toBe("2026-02-26T12:00:00.000Z");
    expect(range.endDate).toBe("2026-03-28T12:00:00.000Z");
    expect(range.source).toBe("deterministic");
    expect(range.matchedText).toBe("last month");
  });

  it("supports explicit bounded ranges", async () => {
    const range = await resolveQuestionDateRange(
      "Page views between March 1 and March 15",
      { now },
    );

    expect(range.startDate).toBe("2026-03-01T00:00:00.000Z");
    expect(range.endDate).toBe("2026-03-15T23:59:59.999Z");
    expect(range.source).toBe("deterministic");
  });

  it("supports since month-name phrases", async () => {
    const range = await resolveQuestionDateRange("Revenue since January", {
      now,
    });

    expect(range.startDate).toBe("2026-01-01T00:00:00.000Z");
    expect(range.endDate).toBe("2026-03-28T12:00:00.000Z");
    expect(range.source).toBe("deterministic");
  });

  it("supports year to date", async () => {
    const range = await resolveQuestionDateRange(
      "Show purchases year to date",
      { now },
    );

    expect(range.startDate).toBe("2026-01-01T00:00:00.000Z");
    expect(range.endDate).toBe("2026-03-28T12:00:00.000Z");
    expect(range.source).toBe("deterministic");
  });

  it("uses the fallback parser only when deterministic parsing does not match", async () => {
    const fallbackParser = vi.fn().mockResolvedValue({
      startDate: "2026-03-01T00:00:00.000Z",
      endDate: "2026-03-07T23:59:59.999Z",
      confidence: "medium",
      needsClarification: false,
      matchedText: "launch week",
    });

    const range = await resolveQuestionDateRange(
      "Show conversions during the launch week",
      {
        now,
        fallbackParser,
      },
    );

    expect(fallbackParser).toHaveBeenCalledOnce();
    expect(range.startDate).toBe("2026-03-01T00:00:00.000Z");
    expect(range.endDate).toBe("2026-03-07T23:59:59.999Z");
    expect(range.source).toBe("llm");
    expect(range.confidence).toBe("medium");
  });

  it("returns a clarification result when the fallback parser cannot safely resolve the range", async () => {
    const range = await resolveQuestionDateRange(
      "Compare performance from the early part of launch season",
      {
        now,
        fallbackParser: vi.fn().mockResolvedValue({
          confidence: "low",
          needsClarification: true,
          matchedText: "early part of launch season",
        }),
      },
    );

    expect(range.needsClarification).toBe(true);
    expect(range.source).toBe("llm");
    expect(range.startDate).toBe("");
    expect(range.endDate).toBe("");
  });
});

describe("inferQuestionDateRange", () => {
  it("keeps a synchronous deterministic-only helper for existing callers", () => {
    const range = inferQuestionDateRange(
      "How many purchases happened in the last 30 days?",
      new Date("2026-03-28T12:00:00.000Z"),
    );

    expect(range.startDate).toBe("2026-02-26T12:00:00.000Z");
    expect(range.endDate).toBe("2026-03-28T12:00:00.000Z");
  });
});
