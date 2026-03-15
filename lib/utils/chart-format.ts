/**
 * Abbreviates large numeric values for use on chart Y-axis tick labels (FR-011).
 *
 * Examples:
 *   0        → "0"
 *   999      → "999"
 *   1000     → "1K"
 *   1500     → "1.5K"
 *   1000000  → "1M"
 *   1500000  → "1.5M"
 *   1000000000 → "1B"
 *
 * @param n - The numeric value to abbreviate. Must be non-negative.
 */
export function formatAxisLabel(n: number): string {
  if (n >= 1_000_000_000) {
    const val = n / 1_000_000_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const val = n / 1_000;
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}K`;
  }
  return String(n);
}

/**
 * Formats a rate value (0.0–1.0) as a percentage string for tooltips.
 * e.g. 0.032 → "3.2%"
 */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Formats an ISO date string ("YYYY-MM-DD") into a short human-readable label.
 * e.g. "2026-03-09" → "Mar 9"
 */
export function formatDateLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
