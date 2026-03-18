'use client';

import { type RetentionResult } from '@/lib/services/retention-service';

function formatCohortDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function RetentionGrid({
  result,
  title,
  description,
}: {
  result: RetentionResult;
  title?: string;
  description?: string;
}) {
  return (
    <div className="space-y-6" data-testid="retention-grid">
      <div>
        <h2 className="text-xl font-semibold font-[family-name:var(--font-space-grotesk)]">
          {title ?? 'Retention Grid'}
        </h2>
        <p className="mt-2 text-sm text-[#7A7A7A]">
          {description ?? 'Cohorts grouped by first activity in the selected lookback window.'}
        </p>
      </div>

      {result.cohorts.length === 0 ? (
        <div className="border border-dashed border-[#E8E8E8] bg-white px-6 py-8 text-sm text-[#7A7A7A]">
          No cohorts found for the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#E8E8E8] bg-white">
          <div className="min-w-[760px]">
            <div className="flex border-b border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 text-xs font-medium text-[#7A7A7A]">
              <div className="w-[160px]">Cohort</div>
              <div className="w-[120px]">Users</div>
              {result.buckets.map((bucket) => (
                <div key={bucket} className="w-[110px]">
                  {bucket}
                </div>
              ))}
            </div>

            {result.cohorts.map((cohort) => (
              <div
                key={cohort.cohortStart}
                className="flex border-t border-[#E8E8E8] px-4 py-4 text-sm first:border-t-0"
              >
                <div className="w-[160px] font-medium">
                  {formatCohortDate(cohort.cohortStart)}
                </div>
                <div className="w-[120px]">{cohort.cohortSize}</div>
                {cohort.cells.map((cell) => (
                  <div key={cell.bucket} className="w-[110px]">
                    <div className="font-medium">
                      {(cell.rate * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-[#7A7A7A]">{cell.users} users</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
