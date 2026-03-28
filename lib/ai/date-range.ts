const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * DAY_MS);
}

export function inferQuestionDateRange(
  question: string,
  now = new Date(),
): { startDate: string; endDate: string } {
  const normalized = question.toLowerCase();
  const end = new Date(now);

  if (/\btoday\b/.test(normalized)) {
    return {
      startDate: startOfDay(now).toISOString(),
      endDate: end.toISOString(),
    };
  }

  if (/\byesterday\b/.test(normalized)) {
    const yesterday = subtractDays(now, 1);
    return {
      startDate: startOfDay(yesterday).toISOString(),
      endDate: endOfDay(yesterday).toISOString(),
    };
  }

  const quantifiedMatch = normalized.match(
    /\b(?:last|past)\s+(\d+)\s+(day|days|week|weeks|month|months|quarter|quarters)\b/,
  );
  if (quantifiedMatch) {
    const amount = Number.parseInt(quantifiedMatch[1], 10);
    const unit = quantifiedMatch[2];
    const days =
      unit.startsWith("day")
        ? amount
        : unit.startsWith("week")
          ? amount * 7
          : unit.startsWith("month")
            ? amount * 30
            : amount * 90;

    return {
      startDate: subtractDays(now, days).toISOString(),
      endDate: end.toISOString(),
    };
  }

  if (/\b(?:last|past)\s+week\b/.test(normalized)) {
    return {
      startDate: subtractDays(now, 7).toISOString(),
      endDate: end.toISOString(),
    };
  }

  if (/\b(?:last|past)\s+month\b/.test(normalized)) {
    return {
      startDate: subtractDays(now, 30).toISOString(),
      endDate: end.toISOString(),
    };
  }

  if (/\b(?:last|past)\s+quarter\b/.test(normalized)) {
    return {
      startDate: subtractDays(now, 90).toISOString(),
      endDate: end.toISOString(),
    };
  }

  if (/\b(?:last|past)\s+year\b/.test(normalized)) {
    return {
      startDate: subtractDays(now, 365).toISOString(),
      endDate: end.toISOString(),
    };
  }

  return {
    startDate: subtractDays(now, 7).toISOString(),
    endDate: end.toISOString(),
  };
}
