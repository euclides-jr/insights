interface ChartLoadingSkeletonProps {
  /** Height to match the surrounding ResponsiveContainer (default: 300). */
  height?: number;
}

/**
 * Animated loading skeleton displayed while a chart component fetches its
 * data asynchronously (FR-013, SC-003).
 * Matches the visual footprint of the chart it will replace.
 */
export function ChartLoadingSkeleton({
  height = 300,
}: ChartLoadingSkeletonProps) {
  return (
    <div
      className="w-full rounded-lg bg-gray-100 animate-pulse"
      style={{ height }}
      role="status"
      aria-label="Loading chart data"
    >
      {/* Simulated axis lines */}
      <div className="flex h-full flex-col justify-between p-4 pb-8 opacity-30">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-px w-full bg-gray-300" />
        ))}
      </div>
    </div>
  );
}
