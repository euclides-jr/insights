'use client';

import {
  Area,
  AreaChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartEmptyState } from '@/components/charts/ChartEmptyState';
import { formatAxisLabel } from '@/lib/utils/chart-format';
import { CHART_COLORS } from '@/lib/charts/types';
import type { QueryResultChartProps } from '@/lib/charts/types';

const CHART_HEIGHT = 300;

/** Returns true if the value looks like an ISO date string (YYYY-MM-DD format). */
function isDateLike(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

/**
 * Chart rendering for Query Explorer results.
 * - Uses a LineChart when labelKey values look like dates (trend data).
 * - Uses a BarChart otherwise (categorical comparison).
 * Handles empty results with ChartEmptyState.
 */
export function QueryResultChart({
  results,
  labelKey,
  valueKey,
  chartType = 'auto',
}: QueryResultChartProps) {
  if (results.length === 0) {
    return (
      <ChartEmptyState
        height={CHART_HEIGHT}
        message="No results to visualize."
      />
    );
  }

  // Determine chart type from the first row's labelKey value
  const autoChartType = isDateLike(results[0][labelKey]) ? 'line' : 'bar';
  const resolvedChartType = chartType === 'auto' ? autoChartType : chartType;

  const commonAxisProps = {
    tick: { fill: CHART_COLORS.axisText, fontSize: 12 },
    axisLine: false as const,
    tickLine: false as const,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = (payload[0]?.payload ?? {}) as Record<string, unknown>;
    const rawValue = row[valueKey];
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
        <p className="font-medium text-gray-900">{String(row[labelKey])}</p>
        <p className="text-gray-600">
          {valueKey}:{' '}
          {typeof rawValue === 'number'
            ? rawValue.toLocaleString()
            : String(rawValue)}
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      {resolvedChartType === 'line' ? (
        <LineChart
          data={results}
          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey={labelKey} {...commonAxisProps} />
          <YAxis
            tickFormatter={formatAxisLabel}
            width={48}
            {...commonAxisProps}
          />
          <Tooltip content={tooltipContent} />
          <Line
            type="monotone"
            dataKey={valueKey}
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.primary }}
          />
        </LineChart>
      ) : resolvedChartType === 'area' ? (
        <AreaChart
          data={results}
          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey={labelKey} {...commonAxisProps} />
          <YAxis
            tickFormatter={formatAxisLabel}
            width={48}
            {...commonAxisProps}
          />
          <Tooltip content={tooltipContent} />
          <Area
            type="monotone"
            dataKey={valueKey}
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            fill={CHART_COLORS.primary}
            fillOpacity={0.18}
            activeDot={{ r: 4, fill: CHART_COLORS.primary }}
          />
        </AreaChart>
      ) : (
        <BarChart
          data={results}
          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.grid}
            vertical={false}
          />
          <XAxis dataKey={labelKey} {...commonAxisProps} />
          <YAxis
            tickFormatter={formatAxisLabel}
            width={48}
            {...commonAxisProps}
          />
          <Tooltip content={tooltipContent} />
          <Bar
            dataKey={valueKey}
            fill={CHART_COLORS.primary}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
