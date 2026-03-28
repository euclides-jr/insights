"use client";

import { Button } from "@/components/ui/button";
import type { QueryDefinition } from "@/lib/validations/query-schemas";
import type { AIAnalyticsHistoryEntry } from "@/lib/services/ai-analytics";

interface AIQueryInspectorProps {
  query: QueryDefinition;
  resolvedDateRange?: AIAnalyticsHistoryEntry["resolvedDateRange"];
  onOpenInExplorer: (query: QueryDefinition) => void;
}

export function AIQueryInspector({
  query,
  resolvedDateRange,
  onOpenInExplorer,
}: AIQueryInspectorProps) {
  const groupByLabel = query.groupBy
    ? query.groupBy.kind === "property"
      ? `Property: ${query.groupBy.key}`
      : `Time: ${query.groupBy.bucket}`
    : null;

  const filterCount = query.propertyFilters?.length ?? 0;

  return (
    <details className="border border-[#E8E8E8] group">
      <summary className="flex items-center justify-between px-6 py-3 cursor-pointer select-none text-sm font-medium text-[#0D0D0D] hover:bg-[#FAFAFA] list-none">
        <span>Generated Query</span>
        <span className="text-[#7A7A7A] text-xs group-open:hidden">▼ Show</span>
        <span className="text-[#7A7A7A] text-xs hidden group-open:inline">
          ▲ Hide
        </span>
      </summary>

      <div className="px-6 py-4 border-t border-[#E8E8E8] space-y-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {query.eventName && (
            <>
              <dt className="text-[#7A7A7A] font-medium">Event</dt>
              <dd className="text-[#0D0D0D] font-mono">{query.eventName}</dd>
            </>
          )}
          <dt className="text-[#7A7A7A] font-medium">Date range</dt>
          <dd className="text-[#0D0D0D]">
            {new Date(query.startDate).toLocaleDateString()} →{" "}
            {new Date(query.endDate).toLocaleDateString()}
          </dd>
          {resolvedDateRange && (
            <>
              <dt className="text-[#7A7A7A] font-medium">Date source</dt>
              <dd className="text-[#0D0D0D]">
                {resolvedDateRange.source === "provided"
                  ? "Provided directly"
                  : resolvedDateRange.source === "deterministic"
                    ? "Interpreted from the prompt"
                    : resolvedDateRange.source === "llm"
                      ? "Resolved with AI fallback"
                      : "Defaulted to the last 7 days"}
                <span className="ml-2 text-xs text-[#7A7A7A]">
                  confidence: {resolvedDateRange.confidence}
                </span>
              </dd>
            </>
          )}
          <dt className="text-[#7A7A7A] font-medium">Aggregation</dt>
          <dd className="text-[#0D0D0D]">
            {query.aggregation}
            {query.aggregationField ? ` of ${query.aggregationField}` : ""}
          </dd>
          {groupByLabel && (
            <>
              <dt className="text-[#7A7A7A] font-medium">Group by</dt>
              <dd className="text-[#0D0D0D]">{groupByLabel}</dd>
            </>
          )}
          {filterCount > 0 && (
            <>
              <dt className="text-[#7A7A7A] font-medium">Filters</dt>
              <dd className="text-[#0D0D0D]">
                {filterCount} filter{filterCount !== 1 ? "s" : ""}
                {query.propertyFilters?.map((f, i) => (
                  <span
                    key={i}
                    className="block font-mono text-xs text-[#7A7A7A]"
                  >
                    {f.key} {f.operator}{" "}
                    {"value" in f && f.value !== undefined
                      ? String(f.value)
                      : ""}
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>

        <div className="pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenInExplorer(query)}
          >
            Open in Query Explorer
          </Button>
        </div>
      </div>
    </details>
  );
}
