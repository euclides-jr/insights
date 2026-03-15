'use client';

import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ChartEmptyState } from '@/components/charts/ChartEmptyState';
import { formatAxisLabel } from '@/lib/utils/chart-format';
import { CHART_COLORS } from '@/lib/charts/types';
import type {
  EventsByApplicationChartProps,
  ApplicationEventCount,
} from '@/lib/charts/types';

const CHART_HEIGHT = 240;

/**
 * Bar chart showing total event counts per application.
 * Clicking a bar navigates to the filtered events page (FR — US4).
 */
export function EventsByApplicationChart({
  data,
}: EventsByApplicationChartProps) {
  const router = useRouter();

  if (data.length === 0) {
    return (
      <ChartEmptyState
        height={CHART_HEIGHT}
        message="No application event data available."
      />
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-900">
        Events by Application
      </h2>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
          onClick={(state: unknown) => {
            const s = state as {
              activePayload?: Array<{ payload: ApplicationEventCount }>;
            } | null;
            if (s?.activePayload?.[0]) {
              const point = s.activePayload[0].payload;
              router.push(`/events?appId=${point.applicationId}`);
            }
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.grid}
            vertical={false}
          />
          <XAxis
            dataKey="applicationName"
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
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as ApplicationEventCount;
              return (
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
                  <p className="font-medium text-gray-900">
                    {point.applicationName}
                  </p>
                  <p className="text-gray-600">
                    {point.count.toLocaleString()} event
                    {point.count !== 1 ? 's' : ''}
                  </p>
                  <p className="mt-1 text-xs text-blue-500">
                    Click to view events →
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} className="cursor-pointer">
            {data.map((entry) => (
              <Cell key={entry.applicationId} fill={CHART_COLORS.primary} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
