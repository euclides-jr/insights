import { describe, it, expect } from 'vitest';
import {
  formatAxisLabel,
  formatRate,
  formatDateLabel,
} from '@/lib/utils/chart-format';
import type { ChartEligibility } from '@/lib/charts/types';

// ---------------------------------------------------------------------------
// formatAxisLabel — T017
// ---------------------------------------------------------------------------

describe('formatAxisLabel', () => {
  it('returns "0" for 0', () => {
    expect(formatAxisLabel(0)).toBe('0');
  });

  it('returns the number as-is for values below 1000', () => {
    expect(formatAxisLabel(1)).toBe('1');
    expect(formatAxisLabel(999)).toBe('999');
  });

  it('abbreviates exactly 1000 as "1K"', () => {
    expect(formatAxisLabel(1000)).toBe('1K');
  });

  it('abbreviates 1500 as "1.5K"', () => {
    expect(formatAxisLabel(1500)).toBe('1.5K');
  });

  it('abbreviates 2000 as "2K" (no trailing zeros)', () => {
    expect(formatAxisLabel(2000)).toBe('2K');
  });

  it('abbreviates exactly 1_000_000 as "1M"', () => {
    expect(formatAxisLabel(1_000_000)).toBe('1M');
  });

  it('abbreviates 1_500_000 as "1.5M"', () => {
    expect(formatAxisLabel(1_500_000)).toBe('1.5M');
  });

  it('abbreviates 999_900 as "999.9K"', () => {
    expect(formatAxisLabel(999_900)).toBe('999.9K');
  });

  it('abbreviates 999_999 as "1000.0K" (rounds up)', () => {
    expect(formatAxisLabel(999_999)).toBe('1000.0K');
  });

  it('abbreviates exactly 1_000_000_000 as "1B"', () => {
    expect(formatAxisLabel(1_000_000_000)).toBe('1B');
  });

  it('abbreviates 2_500_000_000 as "2.5B"', () => {
    expect(formatAxisLabel(2_500_000_000)).toBe('2.5B');
  });
});

// ---------------------------------------------------------------------------
// formatRate — T017
// ---------------------------------------------------------------------------

describe('formatRate', () => {
  it('formats 0 as "0.0%"', () => expect(formatRate(0)).toBe('0.0%'));
  it('formats 1 as "100.0%"', () => expect(formatRate(1)).toBe('100.0%'));
  it('formats 0.032 as "3.2%"', () => expect(formatRate(0.032)).toBe('3.2%'));
  it('returns "—" for null', () => expect(formatRate(null)).toBe('—'));
  it('returns "—" for undefined', () =>
    expect(formatRate(undefined)).toBe('—'));
});

// ---------------------------------------------------------------------------
// formatDateLabel — T017
// ---------------------------------------------------------------------------

describe('formatDateLabel', () => {
  it('formats "2026-03-09" as "Mar 9"', () => {
    expect(formatDateLabel('2026-03-09')).toBe('Mar 9');
  });

  it('formats "2026-01-01" as "Jan 1"', () => {
    expect(formatDateLabel('2026-01-01')).toBe('Jan 1');
  });
});

// ---------------------------------------------------------------------------
// ChartEligibility detection logic — T017
// Extracted computeEligibility logic, tested as pure function
// ---------------------------------------------------------------------------

function computeEligibility(
  results: Record<string, unknown>[],
): ChartEligibility {
  if (!results || results.length === 0) {
    return { eligible: false, reason: 'No results to chart' };
  }
  const firstRow = results[0];
  const cols = Object.keys(firstRow);
  const hasNumeric = cols.some((k) => typeof firstRow[k] === 'number');
  const hasLabel = cols.some((k) => typeof firstRow[k] !== 'number');
  if (!hasNumeric)
    return { eligible: false, reason: 'No numeric column found for Y-axis' };
  if (!hasLabel)
    return { eligible: false, reason: 'No label column found for X-axis' };
  return { eligible: true };
}

describe('computeEligibility', () => {
  it('returns eligible=false with reason when results are empty', () => {
    const result = computeEligibility([]);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('returns eligible=false when all columns are numeric (no label column)', () => {
    const result = computeEligibility([{ count: 10, total: 5 }]);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('label');
  });

  it('returns eligible=false when all columns are non-numeric (no value column)', () => {
    const result = computeEligibility([{ name: 'foo', category: 'bar' }]);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('numeric');
  });

  it('returns eligible=true for a result with one string and one numeric column', () => {
    const result = computeEligibility([{ eventName: 'page_view', count: 42 }]);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns eligible=true for multi-column results with mixed types', () => {
    const result = computeEligibility([
      { date: '2026-03-01', app: 'Web', count: 100 },
      { date: '2026-03-02', app: 'Web', count: 200 },
    ]);
    expect(result.eligible).toBe(true);
  });

  it('returns eligible=true for date-grouped aggregation results', () => {
    const result = computeEligibility([
      { day: '2026-03-01', total_events: 55 },
    ]);
    expect(result.eligible).toBe(true);
  });
});
