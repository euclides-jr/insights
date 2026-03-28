import { parseDate } from "chrono-node";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 7;
const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

type ParseConfidence = "high" | "medium" | "low";

export type DateRangeParserSource =
  | "provided"
  | "deterministic"
  | "llm"
  | "default";

export interface DateRangeParseResult {
  startDate: string;
  endDate: string;
  source: DateRangeParserSource;
  confidence: ParseConfidence;
  needsClarification: boolean;
  matchedText?: string;
}

export interface DateRangeFallbackResult {
  startDate?: string;
  endDate?: string;
  confidence: ParseConfidence;
  needsClarification: boolean;
  matchedText?: string;
}

export type DateRangeFallbackParser = (params: {
  question: string;
  now: Date;
}) => Promise<DateRangeFallbackResult | null>;

interface ResolveQuestionDateRangeOptions {
  now?: Date;
  fallbackParser?: DateRangeFallbackParser;
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setUTCHours(23, 59, 59, 999);
  return value;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}

function startOfQuarter(year: number, quarter: number): Date {
  return new Date(Date.UTC(year, (quarter - 1) * 3, 1));
}

function endOfQuarter(year: number, quarter: number): Date {
  return new Date(Date.UTC(year, quarter * 3, 0, 23, 59, 59, 999));
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * DAY_MS);
}

function buildResult(
  startDate: Date,
  endDate: Date,
  source: DateRangeParserSource,
  confidence: ParseConfidence,
  matchedText?: string,
): DateRangeParseResult {
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    source,
    confidence,
    needsClarification: false,
    matchedText,
  };
}

function buildDefaultRange(now: Date): DateRangeParseResult {
  return buildResult(
    subtractDays(now, DEFAULT_LOOKBACK_DAYS),
    now,
    "default",
    "low",
  );
}

function hasExplicitYear(value: string): boolean {
  return /\b\d{4}\b/.test(value);
}

function cleanTemporalFragment(value: string): string {
  return value
    .replace(/[?.!]+$/g, "")
    .replace(/(?:,\s*|\s+)(?:broken down|grouped|split)\s+by\s+.+$/i, "")
    .replace(/(?:,\s*|\s+)for\s+the\s+app.+$/i, "")
    .trim();
}

function monthIndexFromText(value: string): number | null {
  const normalized = value.trim().toLowerCase();

  for (const [index, month] of MONTH_NAMES.entries()) {
    if (normalized.startsWith(month)) return index;
    if (normalized.startsWith(month.slice(0, 3))) return index;
  }

  return null;
}

function parseMonthFragment(
  value: string,
  now: Date,
  boundary: "start" | "end",
): Date | null {
  const cleaned = cleanTemporalFragment(value);
  if (!/^[a-z]+\s*(\d{4})?$/i.test(cleaned)) {
    return null;
  }

  const monthIndex = monthIndexFromText(cleaned);

  if (monthIndex === null) return null;

  const explicitYearMatch = cleaned.match(/\b(\d{4})\b/);
  let year = explicitYearMatch
    ? Number.parseInt(explicitYearMatch[1], 10)
    : now.getUTCFullYear();

  if (!explicitYearMatch && monthIndex > now.getUTCMonth()) {
    year -= 1;
  }

  const monthDate = new Date(Date.UTC(year, monthIndex, 1));
  return boundary === "start" ? startOfMonth(monthDate) : endOfMonth(monthDate);
}

function parseQuarterFragment(
  value: string,
  now: Date,
  boundary: "start" | "end",
): Date | null {
  const cleaned = cleanTemporalFragment(value);
  const match = cleaned.match(/\bq([1-4])(?:\s+(\d{4}))?\b/i);
  if (!match) return null;

  const quarter = Number.parseInt(match[1], 10);
  let year = match[2] ? Number.parseInt(match[2], 10) : now.getUTCFullYear();

  if (!match[2] && quarter > Math.floor(now.getUTCMonth() / 3) + 1) {
    year -= 1;
  }

  return boundary === "start"
    ? startOfQuarter(year, quarter)
    : endOfQuarter(year, quarter);
}

function adjustInferredDate(date: Date, now: Date, source: string): Date {
  const adjusted = new Date(date);

  if (!hasExplicitYear(source) && adjusted.getTime() > now.getTime()) {
    adjusted.setUTCFullYear(adjusted.getUTCFullYear() - 1);
  }

  return adjusted;
}

function parseTemporalBoundary(
  value: string,
  now: Date,
  boundary: "start" | "end",
): Date | null {
  const cleaned = cleanTemporalFragment(value);
  if (!cleaned) return null;

  const monthDate = parseMonthFragment(cleaned, now, boundary);
  if (monthDate) return monthDate;

  const quarterDate = parseQuarterFragment(cleaned, now, boundary);
  if (quarterDate) return quarterDate;

  const parsed = parseDate(cleaned, now, { forwardDate: false });
  if (!parsed) return null;

  const adjusted = adjustInferredDate(parsed, now, cleaned);
  return boundary === "start" ? startOfDay(adjusted) : endOfDay(adjusted);
}

function parseQuantifiedRange(
  normalized: string,
  now: Date,
): DateRangeParseResult | null {
  const quantifiedMatch = normalized.match(
    /\b(?:last|past)\s+(\d+)\s+(day|days|week|weeks|month|months|quarter|quarters|year|years)\b/,
  );
  if (!quantifiedMatch) return null;

  const amount = Number.parseInt(quantifiedMatch[1], 10);
  const unit = quantifiedMatch[2];
  const days = unit.startsWith("day")
    ? amount
    : unit.startsWith("week")
      ? amount * 7
      : unit.startsWith("month")
        ? amount * 30
        : unit.startsWith("quarter")
          ? amount * 90
          : amount * 365;

  return buildResult(
    subtractDays(now, days),
    now,
    "deterministic",
    "high",
    quantifiedMatch[0],
  );
}

function parseCalendarKeywordRange(
  normalized: string,
  now: Date,
): DateRangeParseResult | null {
  if (/\btoday\b/.test(normalized)) {
    return buildResult(startOfDay(now), now, "deterministic", "high", "today");
  }

  if (/\byesterday\b/.test(normalized)) {
    const yesterday = subtractDays(now, 1);
    return buildResult(
      startOfDay(yesterday),
      endOfDay(yesterday),
      "deterministic",
      "high",
      "yesterday",
    );
  }

  if (/\b(?:last|past)\s+week\b/.test(normalized)) {
    return buildResult(
      subtractDays(now, 7),
      now,
      "deterministic",
      "high",
      "last week",
    );
  }

  if (/\b(?:last|past)\s+month\b/.test(normalized)) {
    return buildResult(
      subtractDays(now, 30),
      now,
      "deterministic",
      "high",
      "last month",
    );
  }

  if (/\b(?:last|past)\s+quarter\b/.test(normalized)) {
    return buildResult(
      subtractDays(now, 90),
      now,
      "deterministic",
      "high",
      "last quarter",
    );
  }

  if (/\b(?:last|past)\s+year\b/.test(normalized)) {
    return buildResult(
      subtractDays(now, 365),
      now,
      "deterministic",
      "high",
      "last year",
    );
  }

  if (/\b(?:year to date|ytd)\b/.test(normalized)) {
    return buildResult(
      new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
      now,
      "deterministic",
      "high",
      "year to date",
    );
  }

  return null;
}

function parseExplicitRange(
  question: string,
  now: Date,
): DateRangeParseResult | null {
  const betweenMatch = question.match(
    /\bbetween\s+(.+?)\s+and\s+(.+?)(?:$|[?.!])/i,
  );
  if (betweenMatch) {
    const start = parseTemporalBoundary(betweenMatch[1], now, "start");
    const end = parseTemporalBoundary(betweenMatch[2], now, "end");

    if (start && end && end > start) {
      return buildResult(start, end, "deterministic", "high", betweenMatch[0]);
    }
  }

  const fromToMatch = question.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?:$|[?.!])/i);
  if (fromToMatch) {
    const start = parseTemporalBoundary(fromToMatch[1], now, "start");
    const end = parseTemporalBoundary(fromToMatch[2], now, "end");

    if (start && end && end > start) {
      return buildResult(start, end, "deterministic", "high", fromToMatch[0]);
    }
  }

  const sinceMatch = question.match(/\bsince\s+(.+?)(?:$|[?.!,])/i);
  if (sinceMatch) {
    const start = parseTemporalBoundary(sinceMatch[1], now, "start");

    if (start && start < now) {
      return buildResult(start, now, "deterministic", "medium", sinceMatch[0]);
    }
  }

  return null;
}

function parseNamedPeriod(
  question: string,
  now: Date,
): DateRangeParseResult | null {
  const inMonthMatch = question.match(
    /\b(?:in|during|for)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+\d{4})?\b/i,
  );
  if (inMonthMatch) {
    const start = parseTemporalBoundary(inMonthMatch[1], now, "start");
    const end = parseTemporalBoundary(inMonthMatch[1], now, "end");

    if (start && end) {
      return buildResult(
        start,
        end,
        "deterministic",
        "medium",
        inMonthMatch[0],
      );
    }
  }

  const quarterMatch = question.match(
    /\b(?:in|during|for)\s+(q[1-4](?:\s+\d{4})?)\b/i,
  );
  if (quarterMatch) {
    const start = parseTemporalBoundary(quarterMatch[1], now, "start");
    const end = parseTemporalBoundary(quarterMatch[1], now, "end");

    if (start && end) {
      return buildResult(
        start,
        end,
        "deterministic",
        "medium",
        quarterMatch[0],
      );
    }
  }

  return null;
}

function parseDeterministicDateRange(
  question: string,
  now: Date,
): DateRangeParseResult | null {
  const normalized = question.toLowerCase();

  return (
    parseCalendarKeywordRange(normalized, now) ??
    parseQuantifiedRange(normalized, now) ??
    parseExplicitRange(question, now) ??
    parseNamedPeriod(question, now)
  );
}

export async function resolveQuestionDateRange(
  question: string,
  options: ResolveQuestionDateRangeOptions = {},
): Promise<DateRangeParseResult> {
  const now = options.now ?? new Date();

  const deterministic = parseDeterministicDateRange(question, now);
  if (deterministic) return deterministic;

  if (options.fallbackParser) {
    const fallback = await options.fallbackParser({ question, now });
    if (fallback?.needsClarification) {
      return {
        startDate: "",
        endDate: "",
        source: "llm",
        confidence: fallback.confidence,
        needsClarification: true,
        matchedText: fallback.matchedText,
      };
    }

    if (fallback?.startDate && fallback.endDate) {
      return {
        startDate: fallback.startDate,
        endDate: fallback.endDate,
        source: "llm",
        confidence: fallback.confidence,
        needsClarification: false,
        matchedText: fallback.matchedText,
      };
    }
  }

  return buildDefaultRange(now);
}

export function inferQuestionDateRange(
  question: string,
  now = new Date(),
): { startDate: string; endDate: string } {
  const resolved =
    parseDeterministicDateRange(question, now) ?? buildDefaultRange(now);
  return {
    startDate: resolved.startDate,
    endDate: resolved.endDate,
  };
}
