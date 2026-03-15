interface ChartEmptyStateProps {
  /** Optional custom message. Defaults to a generic empty-data message. */
  message?: string;
  /** Height to match the surrounding ResponsiveContainer (default: 300). */
  height?: number;
}

/**
 * Fallback rendered inside a ResponsiveContainer-sized box when a chart
 * series is empty (FR-008).
 */
export function ChartEmptyState({
  message = 'No data available for the selected time range.',
  height = 300,
}: ChartEmptyStateProps) {
  return (
    <div
      className="flex items-center justify-center text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200"
      style={{ height }}
      role="status"
      aria-label="No chart data"
    >
      {message}
    </div>
  );
}
