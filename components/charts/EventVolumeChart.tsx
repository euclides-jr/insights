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
} from 'recharts';
import { TimeRangeSelector } from '@/components/ui/time-range-selector';
import { ChartEmptyState } from '@/components/charts/ChartEmptyState';
import { ChartLoadingSkeleton } from '@/components/charts/ChartLoadingSkeleton';
import { formatAxisLabel, formatDateLabel } from '@/lib/utils/chart-format';
import { CHART_COLORS } from '@/lib/charts/types';
import type {
  EventVolumeChartProps,
  TimeSeriesPoint,
  TimeRangeOption,
} from '@/lib/charts/types';

const CHART_HEIGHT = 300;

/**
 * Interactive time-series line chart showing daily event counts.
 * Server-fetches initial data; client-side re-fetches on time range change (FR-012).
 */
export function EventVolumeChart({
  initialData,
  applicationId,
}: EventVolumeChartProps) {
  const [days, setDays] = useState<TimeRangeOption>(7);
  const [data, setData] = useState<TimeSeriesPoint[]>(initialData);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (newDays: TimeRangeOption) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const params = new URLSearchParams({ days: String(newDays) });
        if (applicationId) params.set('applicationId', applicationId);

        const res = await fetch(`/api/charts/events-over-time?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Failed to fetch chart data');

        const json = await res.json();
        setData(json.series);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('EventVolumeChart fetch error:', err);
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
        <h2 className="text-base font-semibold text-gray-900">Event Volume</h2>
        <TimeRangeSelector
          value={days}
          onChange={handleDaysChange}
          disabled={loading}
        />
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
              tickFormatter={formatAxisLabel}
              tick={{ fill: CHART_COLORS.axisText, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as TimeSeriesPoint;
                return (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
                    <p className="font-medium text-gray-900">
                      {formatDateLabel(point.date)}
                    </p>
                    <p className="text-gray-600">
                      {point.count.toLocaleString()} event
                      {point.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.primary }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
