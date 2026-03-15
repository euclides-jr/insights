'use client';

import { useState, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import { TimeRangeSelector } from '@/components/ui/time-range-selector';
import { ChartEmptyState } from '@/components/charts/ChartEmptyState';
import { ChartLoadingSkeleton } from '@/components/charts/ChartLoadingSkeleton';
import { formatDateLabel, formatRate } from '@/lib/utils/chart-format';
import { CHART_COLORS } from '@/lib/charts/types';
import {
  THRESHOLDS,
  failureRateAlert,
  completenessAlert,
  duplicateRateAlert,
} from '@/lib/charts/quality-thresholds';
import type {
  QualityTrendsChartProps,
  QualityTrendPoint,
  TimeRangeOption,
} from '@/lib/charts/types';

const CHART_HEIGHT = 300;

/** Colours for the three metric lines */
const LINE_COLORS = {
  validationFailureRate: CHART_COLORS.primary,
  completenessRate: CHART_COLORS.secondary,
  duplicateRate: CHART_COLORS.tertiary,
} as const;

type MetricKey = keyof typeof LINE_COLORS;

/**
 * Returns red fill when the non-null value crosses an alert threshold;
 * otherwise the line's default colour.
 */
function dotFill(metric: MetricKey, value: number | null): string {
  if (value === null) return 'transparent';
  let level: ReturnType<typeof failureRateAlert>;
  if (metric === 'validationFailureRate') level = failureRateAlert(value);
  else if (metric === 'completenessRate') level = completenessAlert(value);
  else level = duplicateRateAlert(value);

  return level === 'error' || level === 'warning'
    ? CHART_COLORS.alert
    : LINE_COLORS[metric];
}

/** Custom Dot that skips null values (renders nothing) */
function ThresholdDot(metric: MetricKey) {
  // eslint-disable-next-line react/display-name
  return function CustomDot(props: Record<string, unknown>) {
    const { cx, cy, value } = props as {
      cx: number;
      cy: number;
      value: number | null;
    };
    if (value === null || value === undefined) return null;
    const fill = dotFill(metric, value);
    return <Dot cx={cx} cy={cy} r={3} fill={fill} stroke={fill} />;
  };
}

/**
 * Multi-line quality trends chart (failure rate, completeness, duplicate rate).
 * Null gap days render as broken segments (connectNulls={false}), not false zeros.
 */
export function QualityTrendsChart({
  initialData,
  applicationId,
  days: initialDays,
}: QualityTrendsChartProps) {
  const [days, setDays] = useState<TimeRangeOption>(() => {
    const d = initialDays;
    if (d === 7 || d === 30 || d === 90) return d as TimeRangeOption;
    return 7;
  });
  const [data, setData] = useState<QualityTrendPoint[]>(initialData);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (newDays: TimeRangeOption) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const params = new URLSearchParams({ days: String(newDays) });
        if (applicationId) params.set('applicationId', applicationId);

        const res = await fetch(`/api/charts/quality-trends?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Failed to fetch quality trends');

        const json = await res.json();
        setData(json.series);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('QualityTrendsChart fetch error:', err);
      } finally {
        setLoading(false);
      }
    },
    [applicationId],
  );

  const handleDaysChange = useCallback(
    (newDays: TimeRangeOption) => {
      setDays(newDays);
      void fetchData(newDays);
    },
    [fetchData],
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Quality Trends
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Thresholds: failure ≥
            {THRESHOLDS.validationFailureRate.warning * 100}%, completeness ≤
            {THRESHOLDS.completenessRate.warning * 100}%, duplicates ≥
            {THRESHOLDS.duplicateRate.warning * 100}%
          </p>
        </div>
        <TimeRangeSelector
          value={days}
          onChange={handleDaysChange}
          disabled={loading}
        />
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-600">
        {(Object.entries(LINE_COLORS) as [MetricKey, string][]).map(
          ([key, color]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-4 rounded-full"
                style={{ backgroundColor: color }}
              />
              {key === 'validationFailureRate'
                ? 'Failure Rate'
                : key === 'completenessRate'
                  ? 'Completeness'
                  : 'Duplicate Rate'}
            </span>
          ),
        )}
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-4 rounded-full"
            style={{ backgroundColor: CHART_COLORS.alert }}
          />
          Alert
        </span>
      </div>

      {loading ? (
        <ChartLoadingSkeleton height={CHART_HEIGHT} />
      ) : data.length === 0 ? (
        <ChartEmptyState height={CHART_HEIGHT} />
      ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart
            data={data}
            margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={[0, 1]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as QualityTrendPoint;
                return (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
                    <p className="font-medium text-gray-900 mb-1">
                      {formatDateLabel(point.date)}
                    </p>
                    <p className="text-gray-600">
                      Failure:{' '}
                      <span
                        className={
                          point.validationFailureRate !== null &&
                          failureRateAlert(point.validationFailureRate) !== 'ok'
                            ? 'font-semibold text-red-600'
                            : ''
                        }
                      >
                        {formatRate(point.validationFailureRate)}
                      </span>
                    </p>
                    <p className="text-gray-600">
                      Completeness:{' '}
                      <span
                        className={
                          point.completenessRate !== null &&
                          completenessAlert(point.completenessRate) !== 'ok'
                            ? 'font-semibold text-red-600'
                            : ''
                        }
                      >
                        {formatRate(point.completenessRate)}
                      </span>
                    </p>
                    <p className="text-gray-600">
                      Duplicates:{' '}
                      <span
                        className={
                          point.duplicateRate !== null &&
                          duplicateRateAlert(point.duplicateRate) !== 'ok'
                            ? 'font-semibold text-red-600'
                            : ''
                        }
                      >
                        {formatRate(point.duplicateRate)}
                      </span>
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="validationFailureRate"
              stroke={LINE_COLORS.validationFailureRate}
              strokeWidth={2}
              connectNulls={false}
              dot={ThresholdDot('validationFailureRate')}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="completenessRate"
              stroke={LINE_COLORS.completenessRate}
              strokeWidth={2}
              connectNulls={false}
              dot={ThresholdDot('completenessRate')}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="duplicateRate"
              stroke={LINE_COLORS.duplicateRate}
              strokeWidth={2}
              connectNulls={false}
              dot={ThresholdDot('duplicateRate')}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
