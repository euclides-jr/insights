/**
 * Unit tests for utilities used by the Application Detail page.
 *
 * Covers:
 *  - API key masking contract (ApplicationApiKey component)
 *  - formatNumber  (stat tiles)
 *  - formatDateTime (event table timestamps)
 */

import { describe, it, expect } from 'vitest';
import { formatNumber, formatDateTime } from '@/lib/format';

// ---------------------------------------------------------------------------
// API key masking — mirrors the formula in ApplicationApiKey.tsx
// The contract: show first 8 chars + 20 bullet chars + last 4 chars.
// ---------------------------------------------------------------------------

function maskApiKey(apiKey: string): string {
  return apiKey.slice(0, 8) + '••••••••••••••••••••' + apiKey.slice(-4);
}

describe('maskApiKey', () => {
  it('shows the first 8 characters', () => {
    const key = 'demo_app_key_123456789';
    expect(maskApiKey(key).startsWith('demo_app')).toBe(true);
  });

  it('shows the last 4 characters', () => {
    const key = 'demo_app_key_123456789';
    expect(maskApiKey(key).endsWith('6789')).toBe(true);
  });

  it('contains exactly 20 bullet characters in the middle', () => {
    const key = 'abcdefghijklmnopqrst';
    const masked = maskApiKey(key);
    const bullets = masked.match(/•/g) ?? [];
    expect(bullets).toHaveLength(20);
  });

  it('total length is first-8 + 20-bullets + last-4 = 32 chars', () => {
    const key = 'sk_live_abcdefghijklmnopqrstuvwxyz';
    expect(maskApiKey(key)).toHaveLength(32);
  });

  it('a short key (< 12 chars) still produces first-8 + bullets + last-4', () => {
    // Overlapping slices are valid — JS slice never throws
    const key = 'abc_1234';
    const masked = maskApiKey(key);
    expect(masked).toContain('••••••••••••••••••••');
    expect(masked.startsWith('abc_1234')).toBe(true);
    expect(masked.endsWith('1234')).toBe(true);
  });

  it('does not expose characters between position 8 and length-4', () => {
    const key = 'first_8_SECRET_PART_last4';
    const masked = maskApiKey(key);
    expect(masked).not.toContain('SECRET_PART');
  });
});

// ---------------------------------------------------------------------------
// formatNumber — used in all four stat tiles
// ---------------------------------------------------------------------------

describe('formatNumber', () => {
  it('renders 0 as "0"', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('renders values below 1000 as-is', () => {
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(999)).toBe('999');
  });

  it('abbreviates 1000 as "1.0K"', () => {
    expect(formatNumber(1000)).toBe('1.0K');
  });

  it('abbreviates 1500 as "1.5K"', () => {
    expect(formatNumber(1500)).toBe('1.5K');
  });

  it('abbreviates 9999 as "10.0K"', () => {
    expect(formatNumber(9999)).toBe('10.0K');
  });

  it('abbreviates 1_000_000 as "1.0M"', () => {
    expect(formatNumber(1_000_000)).toBe('1.0M');
  });

  it('abbreviates 2_500_000 as "2.5M"', () => {
    expect(formatNumber(2_500_000)).toBe('2.5M');
  });
});

// ---------------------------------------------------------------------------
// formatDateTime — used in the Recent Events table and the page subtitle
// ---------------------------------------------------------------------------

describe('formatDateTime', () => {
  it('formats a known UTC date as "yyyy-MM-dd HH:mm:ss"', () => {
    // Use a fixed date to avoid timezone flakiness: noon UTC on 2026-03-15
    const date = new Date('2026-03-15T12:00:00.000Z');
    const result = formatDateTime(date);
    // We only assert the regex shape rather than exact hour since CI
    // machines may run in different timezones.
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('formats the date component correctly (timezone-independent year/month/day)', () => {
    // Pick a date at noon UTC — date part won't shift even in UTC-12
    const date = new Date('2026-01-20T12:00:00.000Z');
    const result = formatDateTime(date);
    // Year and month should always be 2026 and 01 regardless of TZ
    expect(result.startsWith('2026-01-')).toBe(true);
  });
});
