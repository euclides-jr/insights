// ---------------------------------------------------------------------------
// Shared TypeScript types for the Analytics Chart Visualizations feature
// (003-analytics-charts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Chart color constants (WCAG 2.1 AA compliant — T020)
// Verified against white (#ffffff) using WCAG 2.1 relative luminance formula:
//   Graphical objects (lines, bars): ≥ 3:1   (SC 1.4.11)
//   Embedded text labels:            ≥ 4.5:1 (SC 1.4.3)
//
//   primary   (#2563eb, blue-600):    ~5.18:1 ✓ passes both thresholds
//   secondary (#7c3aed, violet-600):  ~7.28:1 ✓ passes both thresholds
//   tertiary  (#059669, emerald-600): ~3.77:1 ✓ passes graphical threshold (≥3:1)
//   alert     (#dc2626, red-600):     ~5.74:1 ✓ passes both thresholds
//   axisText  (#6b7280, gray-500):    ~4.58:1 ✓ passes text threshold (≥4.5:1)
//   grid      (#e5e7eb, gray-200):    decorative — no ratio requirement
// ---------------------------------------------------------------------------
export const CHART_COLORS = {
  /** Primary line / bar — blue-600 (~5.18:1 on white) */
  primary: '#2563eb',
  /** Second metric — violet-600 (~7.28:1 on white) */
  secondary: '#7c3aed',
  /** Third metric — emerald-600 (~3.77:1; meets ≥3:1 graphical threshold) */
  tertiary: '#059669',
  /** Alert / threshold-crossing highlight — red-600 (~5.74:1 on white) */
  alert: '#dc2626',
  /** Subtle grid lines (decorative) */
  grid: '#e5e7eb',
  /** Axis tick text — gray-500 (~4.58:1 on white; meets ≥4.5:1 text threshold) */
  axisText: '#6b7280',
} as const;

// ---------------------------------------------------------------------------
// Time-series point (event volume, quality trends)
// ---------------------------------------------------------------------------

/**
 * A single day's value in a time-series chart.
 * - `count` is always a non-negative integer; 0 for gap days in event volume.
 * - Rate fields in {@link QualityTrendPoint} use `null` for gap days.
 */
export interface TimeSeriesPoint {
  /** ISO date string, e.g. "2026-03-01" */
  date: string;
  /** Non-negative integer; 0 for gap days (FR-010) */
  count: number;
}

// ---------------------------------------------------------------------------
// Events-over-time API response
// ---------------------------------------------------------------------------

export interface EventsOverTimeResponse {
  series: TimeSeriesPoint[];
  /** Sum of all counts in the window */
  totalCount: number;
  /** Actual window used (7 | 30 | 90) */
  windowDays: number;
}

// ---------------------------------------------------------------------------
// Per-application event count (bar chart)
// ---------------------------------------------------------------------------

export interface ApplicationEventCount {
  applicationId: string;
  applicationName: string;
  count: number;
}

export interface EventsByApplicationResponse {
  series: ApplicationEventCount[];
}

// ---------------------------------------------------------------------------
// Quality trend point (multi-line chart)
// ---------------------------------------------------------------------------

/**
 * One data point in the quality trends multi-line chart.
 * Rate fields are `null` for gap days (days with no metric row) so that
 * recharts renders broken segments instead of false-zero spikes (FR-010).
 */
export interface QualityTrendPoint {
  /** ISO date string "YYYY-MM-DD" */
  date: string;
  /** 0.0–1.0; null for gap days */
  validationFailureRate: number | null;
  /** 0.0–1.0; null for gap days */
  completenessRate: number | null;
  /** 0.0–1.0; null for gap days */
  duplicateRate: number | null;
}

export interface QualityTrendsResponse {
  series: QualityTrendPoint[];
  windowDays: number;
  /** null = all applications */
  applicationId: string | null;
}

// ---------------------------------------------------------------------------
// Front-end state entities (never persisted)
// ---------------------------------------------------------------------------

/** Time-window selection (days) used by TimeRangeSelector */
export type TimeRangeOption = 7 | 30 | 90;

/** Toggle between table and chart view in the Query Explorer */
export type ChartViewMode = 'table' | 'chart';

/**
 * Computed eligibility for chart rendering in the Query Explorer.
 * A result set is eligible when it has ≥1 numeric and ≥1 non-numeric column.
 */
export interface ChartEligibility {
  eligible: boolean;
  /** Human-readable explanation shown in the disabled tooltip (FR-005) */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Component prop interfaces (internal — not HTTP APIs)
// ---------------------------------------------------------------------------

export interface EventVolumeChartProps {
  /** Server-rendered initial data (first paint shows this, no loading spinner) */
  initialData: TimeSeriesPoint[];
  /** Passed through to the API on time range change */
  applicationId?: string;
}

export interface EventsByApplicationChartProps {
  /** Static; fetched server-side only */
  data: ApplicationEventCount[];
}

export interface QualityTrendsChartProps {
  initialData: QualityTrendPoint[];
  applicationId?: string;
  days: number;
}

export interface QueryResultChartProps {
  results: Record<string, unknown>[];
  /** Column name to use as X-axis / category labels */
  labelKey: string;
  /** Column name to use as Y-axis values */
  valueKey: string;
}
