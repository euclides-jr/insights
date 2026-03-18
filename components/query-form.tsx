'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryResultChart } from '@/components/charts/QueryResultChart';
import { SaveReportDialog } from '@/components/reports/save-report-dialog';
import type { ChartViewMode, ChartEligibility } from '@/lib/charts/types';

interface Application {
  id: string;
  name: string;
  apiKey: string;
}

interface QueryResult {
  results: Record<string, unknown>[];
  totalCount: number;
  executionTimeMs: number;
}

export function QueryForm({ applications }: { applications: Application[] }) {
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? '');
  const [eventName, setEventName] = useState('');
  const [startDate, setStartDate] = useState(() =>
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [aggregation, setAggregation] = useState<
    'count' | 'unique_users' | 'avg' | 'sum'
  >('count');
  const [aggregationField, setAggregationField] = useState('');
  const [groupBy, setGroupBy] = useState('');

  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartView, setChartView] = useState<ChartViewMode>('table');
  const [chartEligibility, setChartEligibility] = useState<ChartEligibility>({
    eligible: false,
    reason: 'Run a query first',
  });

  const needsField = aggregation === 'avg' || aggregation === 'sum';

  // Computes whether the current result set is eligible for chart visualization.
  // Eligible = has ≥1 numeric column (Y-axis) and ≥1 non-numeric column (X-axis).
  function computeEligibility(
    results: Record<string, unknown>[],
  ): ChartEligibility {
    if (!results || results.length === 0) {
      return { eligible: false, reason: 'No results to chart' };
    }
    const firstRow = results[0];
    const cols = Object.keys(firstRow);
    const hasNumeric = cols.some((k) => typeof firstRow[k] === 'number');
    const hasLabel = cols.some((k) => typeof firstRow[k] !== 'number');
    if (!hasNumeric)
      return { eligible: false, reason: 'No numeric column found for Y-axis' };
    if (!hasLabel)
      return { eligible: false, reason: 'No label column found for X-axis' };
    return { eligible: true };
  }

  // Auto-detect labelKey (first non-numeric column) and valueKey (first numeric column)
  const { labelKey, valueKey } = useMemo(() => {
    if (!result || result.results.length === 0)
      return { labelKey: '', valueKey: '' };
    const firstRow = result.results[0];
    const cols = Object.keys(firstRow);
    return {
      labelKey: cols.find((k) => typeof firstRow[k] !== 'number') ?? '',
      valueKey: cols.find((k) => typeof firstRow[k] === 'number') ?? '',
    };
  }, [result]);

  // Resolves the API key associated with the selected application.
  // We pass the app's API key via the hidden input below.
  const selectedApp = applications.find((a) => a.id === applicationId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedApp) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const apiKey = formData.get('apiKey') as string;

    const body: Record<string, unknown> = {
      applicationId,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      aggregation,
    };
    if (eventName) body.eventName = eventName;
    if (groupBy) body.groupBy = groupBy;
    if (needsField && aggregationField)
      body.aggregationField = aggregationField;

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Query failed');
      } else {
        setResult(data);
        // Always reset to table view and recompute eligibility on new results
        setChartView('table');
        setChartEligibility(computeEligibility(data.results ?? []));
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* Query Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#E8E8E8] p-8 space-y-6"
      >
        {/* Hidden API key for the selected app */}
        <input
          type="hidden"
          name="apiKey"
          readOnly
          value={selectedApp?.apiKey ?? ''}
        />

        <div className="grid grid-cols-2 gap-6">
          {/* Application */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Application
            </label>
            <select
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              className="w-full h-10 px-3 border border-[#E8E8E8] text-sm bg-white focus:outline-none focus:border-[#0D0D0D]"
            >
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>

          {/* Event Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Event Name
              <span className="ml-1 text-[#7A7A7A] font-normal">
                (optional)
              </span>
            </label>
            <Input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. purchase"
            />
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Start Date
            </label>
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              End Date
            </label>
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          {/* Aggregation */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Aggregation
            </label>
            <select
              value={aggregation}
              onChange={(e) =>
                setAggregation(
                  e.target.value as 'count' | 'unique_users' | 'avg' | 'sum',
                )
              }
              className="w-full h-10 px-3 border border-[#E8E8E8] text-sm bg-white focus:outline-none focus:border-[#0D0D0D]"
            >
              <option value="count">Count events</option>
              <option value="unique_users">Count unique users</option>
              <option value="avg">Average (numeric field)</option>
              <option value="sum">Sum (numeric field)</option>
            </select>
          </div>

          {/* Aggregation Field (conditional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Aggregation Field
              <span className="ml-1 text-[#7A7A7A] font-normal">
                {needsField ? '(required for avg/sum)' : '(not needed)'}
              </span>
            </label>
            <Input
              value={aggregationField}
              onChange={(e) => setAggregationField(e.target.value)}
              placeholder="e.g. amount"
              disabled={!needsField}
              required={needsField}
            />
          </div>

          {/* Group By */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Group By
              <span className="ml-1 text-[#7A7A7A] font-normal">
                (optional)
              </span>
            </label>
            <Input
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              placeholder="e.g. currency"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Running…' : 'Run Query'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setResult(null);
              setError(null);
              setEventName('');
              setGroupBy('');
              setAggregationField('');
              setAggregation('count');
            }}
          >
            Clear
          </Button>
          <SaveReportDialog
            applications={applications.map((application) => ({
              id: application.id,
              name: application.name,
            }))}
            draftReport={{
              name: eventName
                ? `${eventName} ${aggregation}`
                : `Query ${aggregation}`,
              reportType: 'QUERY',
              applicationId,
              config: {
                applicationId,
                eventName: eventName || undefined,
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                aggregation,
                aggregationField: aggregationField || undefined,
                groupBy: groupBy || undefined,
              },
            }}
            buttonLabel="Save Current View"
          />
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 px-6 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Results ({result.totalCount} row
              {result.totalCount !== 1 ? 's' : ''})
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#7A7A7A]">
                {result.executionTimeMs} ms
              </span>
              {/* Chart / Table toggle — FR-005 */}
              <div className="flex items-center rounded-md border border-[#E8E8E8] overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setChartView('table')}
                  className={`px-3 h-8 transition-colors ${
                    chartView === 'table'
                      ? 'bg-[#0D0D0D] text-white'
                      : 'text-[#7A7A7A] hover:bg-[#FAFAFA]'
                  }`}
                  aria-pressed={chartView === 'table'}
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={() =>
                    chartEligibility.eligible && setChartView('chart')
                  }
                  disabled={!chartEligibility.eligible}
                  title={
                    chartEligibility.eligible
                      ? 'View as chart'
                      : chartEligibility.reason
                  }
                  className={`px-3 h-8 transition-colors ${
                    chartView === 'chart'
                      ? 'bg-[#0D0D0D] text-white'
                      : !chartEligibility.eligible
                        ? 'text-[#B0B0B0] cursor-not-allowed'
                        : 'text-[#7A7A7A] hover:bg-[#FAFAFA]'
                  }`}
                  aria-pressed={chartView === 'chart'}
                >
                  Chart
                </button>
              </div>
            </div>
          </div>

          {chartView === 'chart' && chartEligibility.eligible ? (
            <div className="bg-white border border-[#E8E8E8] p-6">
              <QueryResultChart
                results={result.results}
                labelKey={labelKey}
                valueKey={valueKey}
              />
            </div>
          ) : (
            <div className="bg-white border border-[#E8E8E8] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8E8E8] bg-[#FAFAFA]">
                    {result.results.length > 0 &&
                      Object.keys(result.results[0]).map((col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-medium text-[#7A7A7A] whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {result.results.length === 0 ||
                  (result.results.length === 1 &&
                    Object.keys(result.results[0]).length === 1 &&
                    result.results[0].value === 0) ? (
                    <tr>
                      <td
                        colSpan={1}
                        className="px-4 py-8 text-center text-[#7A7A7A]"
                      >
                        No results for this query
                      </td>
                    </tr>
                  ) : (
                    result.results.map((row, i) => (
                      <tr key={i} className="border-b border-[#E8E8E8]">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-4 py-3 text-[#0D0D0D]">
                            {val === null || val === undefined
                              ? '—'
                              : typeof val === 'number'
                                ? val.toLocaleString()
                                : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
