'use client';

import type { TimeRangeOption } from '@/lib/charts/types';

interface TimeRangeSelectorProps {
  value: TimeRangeOption;
  onChange: (value: TimeRangeOption) => void;
  disabled?: boolean;
}

const OPTIONS: { label: string; value: TimeRangeOption }[] = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

/**
 * Pill-style tab selector for choosing a time range (7 / 30 / 90 days).
 * Used by EventVolumeChart and QualityTrendsChart (FR-009).
 */
export function TimeRangeSelector({
  value,
  onChange,
  disabled = false,
}: TimeRangeSelectorProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
      role="group"
      aria-label="Time range"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={[
            'rounded-md px-3 py-1 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            value === opt.value
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          ].join(' ')}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
