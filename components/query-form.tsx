'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { selectChevronStyle, selectInputClass } from '@/components/ui/select';
import { QueryResultChart } from '@/components/charts/QueryResultChart';
import { SaveReportDialog } from '@/components/reports/save-report-dialog';
import { PropertyFilterBuilder } from '@/components/query/property-filter-builder';
import { QueryFieldPicker } from '@/components/query/query-field-picker';
import { QueryExportActions } from '@/components/query/query-export-actions';
import type {
  ChartViewMode,
  ChartEligibility,
  QueryResultChartType,
} from '@/lib/charts/types';
import type {
  PropertyFilter,
  QueryDefinition,
} from '@/lib/validations/query-schemas';
import type { QueryFieldMetadata } from '@/lib/query/field-metadata';
import { serializeQueryStateToQueryString } from '@/lib/query/hydration';

interface Application {
  id: string;
  name: string;
}

interface QueryResult {
  results: Record<string, unknown>[];
  totalCount: number;
  executionTimeMs: number;
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

type EditablePropertyFilter = Omit<PropertyFilter, 'value'> & {
  id: string;
  value?: string | number | boolean | string[] | number[];
  secondValue?: number;
};

export function QueryForm({
  applications,
  fieldMetadataByApplication,
  initialState,
}: {
  applications: Application[];
  fieldMetadataByApplication: Record<string, QueryFieldMetadata[]>;
  initialState?: Partial<QueryDefinition>;
}) {
  const router = useRouter();
  const initialApplicationId =
    (initialState?.applicationId &&
    applications.some((app) => app.id === initialState.applicationId)
      ? initialState.applicationId
      : applications[0]?.id) ?? '';

  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [eventName, setEventName] = useState(initialState?.eventName ?? '');
  const [startDate, setStartDate] = useState(() =>
    (initialState?.startDate
      ? new Date(initialState.startDate)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    )
      .toISOString()
      .slice(0, 16),
  );
  const [endDate, setEndDate] = useState(() =>
    (initialState?.endDate ? new Date(initialState.endDate) : new Date())
      .toISOString()
      .slice(0, 16),
  );
  const [aggregation, setAggregation] = useState<
    'count' | 'unique_users' | 'avg' | 'sum'
  >(initialState?.aggregation ?? 'count');
  const [aggregationField, setAggregationField] = useState(
    initialState?.aggregationField ?? '',
  );
  const [groupMode, setGroupMode] = useState<'property' | 'time'>(
    initialState?.groupBy?.kind === 'time' ? 'time' : 'property',
  );
  const [groupBy, setGroupBy] = useState(
    initialState?.groupBy?.kind === 'property' ? initialState.groupBy.key : '',
  );
  const [timeBucket, setTimeBucket] = useState<'hour' | 'day' | 'week' | 'month'>(
    initialState?.groupBy?.kind === 'time' ? initialState.groupBy.bucket : 'day',
  );
  const [sortField, setSortField] = useState<'group' | 'value'>(
    initialState?.sort?.field ?? 'value',
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    initialState?.sort?.direction ?? 'desc',
  );
  const [pageSize, setPageSize] = useState(initialState?.pageSize ?? 25);
  const [propertyFilters, setPropertyFilters] = useState<EditablePropertyFilter[]>(
    () =>
      (initialState?.propertyFilters ?? []).map((filter, index) => ({
        ...filter,
        id: `hydrated-filter-${index + 1}`,
      })),
  );

  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartView, setChartView] = useState<ChartViewMode>('table');
  const [chartType, setChartType] = useState<QueryResultChartType>('auto');
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

  const selectedApp = applications.find((a) => a.id === applicationId);
  const availableFields = useMemo(() => {
    const allFields = fieldMetadataByApplication[applicationId] ?? [];
    if (!eventName.trim()) {
      return allFields;
    }

    return allFields.filter((field) => field.eventName === eventName.trim());
  }, [applicationId, eventName, fieldMetadataByApplication]);

  function normalizePropertyFilters() {
    return propertyFilters
      .filter((filter) => filter.key.trim())
      .map<PropertyFilter>((filter, index) => {
        const base = {
          key: filter.key.trim(),
          valueType: filter.valueType,
          operator: filter.operator,
          ...(index > 0 ? { logic: filter.logic ?? 'and' } : {}),
        };

        if (filter.operator === 'exists' || filter.operator === 'not_exists') {
          return base as PropertyFilter;
        }

        if (filter.valueType === 'boolean') {
          return {
            ...base,
            value: Boolean(filter.value),
          } as PropertyFilter;
        }

        if (filter.valueType === 'number') {
          if (filter.operator === 'in' || filter.operator === 'not_in') {
            const values = String(filter.value ?? '')
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
              .map(Number);
            return {
              ...base,
              value: values,
            } as PropertyFilter;
          }

          return {
            ...base,
            value:
              filter.value === '' || filter.value === undefined
                ? undefined
                : Number(filter.value),
            ...(filter.operator === 'between'
              ? { secondValue: filter.secondValue }
              : {}),
          } as PropertyFilter;
        }

        if (filter.operator === 'in' || filter.operator === 'not_in') {
          return {
            ...base,
            value: String(filter.value ?? '')
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean),
          } as PropertyFilter;
        }

        return {
          ...base,
          value: String(filter.value ?? ''),
        } as PropertyFilter;
      });
  }

  function buildQueryState(page = 1) {
    return {
      applicationId,
      eventName: eventName || undefined,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      aggregation,
      aggregationField:
        needsField && aggregationField ? aggregationField : undefined,
      page,
      pageSize,
      sort:
        (groupMode === 'property' && groupBy) || groupMode === 'time'
          ? {
              field: sortField,
              direction: sortDirection,
            }
          : undefined,
      groupBy:
        groupMode === 'time'
          ? { kind: 'time' as const, bucket: timeBucket }
          : groupBy
            ? { kind: 'property' as const, key: groupBy }
            : undefined,
      propertyFilters:
        propertyFilters.length > 0 ? normalizePropertyFilters() : undefined,
    };
  }

  async function runQuery(page = 1) {
    if (!selectedApp) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const queryState = buildQueryState(page);
    const body: Record<string, unknown> = {
      applicationId: queryState.applicationId,
      startDate: queryState.startDate,
      endDate: queryState.endDate,
      aggregation: queryState.aggregation,
      page: queryState.page,
      pageSize: queryState.pageSize,
      ...(queryState.eventName ? { eventName: queryState.eventName } : {}),
      ...(queryState.groupBy
        ? {
            groupBy:
              queryState.groupBy.kind === 'property'
                ? queryState.groupBy.key
                : queryState.groupBy,
          }
        : {}),
      ...(queryState.aggregationField
        ? { aggregationField: queryState.aggregationField }
        : {}),
      ...(queryState.sort ? { sort: queryState.sort } : {}),
      ...(queryState.propertyFilters
        ? { propertyFilters: queryState.propertyFilters }
        : {}),
    };

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Query failed');
      } else {
        router.replace(
          `/query?${serializeQueryStateToQueryString(queryState)}`,
          { scroll: false },
        );
        setResult(data);
        // Always reset to table view and recompute eligibility on new results
        setChartView('table');
        setChartType('auto');
        setChartEligibility(computeEligibility(data.results ?? []));
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runQuery(1);
  }

  return (
    <div className="space-y-10">
      {/* Query Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#E8E8E8] p-8 space-y-6"
      >
        <div className="grid grid-cols-2 gap-6">
          {/* Application */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Application
            </label>
            <select
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              className={selectInputClass}
              style={selectChevronStyle}
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
              className={selectInputClass}
              style={selectChevronStyle}
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
            <QueryFieldPicker
              value={aggregationField}
              onChange={setAggregationField}
              placeholder="e.g. amount"
              label="Aggregation field"
              fields={availableFields.filter(
                (field) => field.valueType === 'number',
              )}
              disabled={!needsField}
            />
          </div>

          {/* Group By */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Grouping Mode
              <span className="ml-1 text-[#7A7A7A] font-normal">
                (optional)
              </span>
            </label>
            <select
              value={groupMode}
              onChange={(e) =>
                setGroupMode(e.target.value as 'property' | 'time')
              }
              className={selectInputClass}
              style={selectChevronStyle}
              aria-label="Grouping mode"
            >
              <option value="property">Property</option>
              <option value="time">Time bucket</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              {groupMode === 'time' ? 'Time Bucket' : 'Group By'}
              <span className="ml-1 text-[#7A7A7A] font-normal">
                (optional)
              </span>
            </label>
            {groupMode === 'time' ? (
              <select
                value={timeBucket}
                onChange={(e) =>
                  setTimeBucket(
                    e.target.value as 'hour' | 'day' | 'week' | 'month',
                  )
                }
                className={selectInputClass}
                style={selectChevronStyle}
                aria-label="Time bucket"
              >
                <option value="hour">Hour</option>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            ) : (
              <QueryFieldPicker
                value={groupBy}
                onChange={setGroupBy}
                placeholder="e.g. currency"
                label="Group by field"
                fields={availableFields}
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Sort
            </label>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={sortField}
                onChange={(e) =>
                  setSortField(e.target.value as 'group' | 'value')
                }
                className={selectInputClass}
                style={selectChevronStyle}
                aria-label="Sort field"
              >
                <option value="value">Value</option>
                <option value="group">Group</option>
              </select>
              <select
                value={sortDirection}
                onChange={(e) =>
                  setSortDirection(e.target.value as 'asc' | 'desc')
                }
                className={selectInputClass}
                style={selectChevronStyle}
                aria-label="Sort direction"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Row Limit
            </label>
            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={selectInputClass}
              style={selectChevronStyle}
              aria-label="Row limit"
            >
              <option value="10">10 rows</option>
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
            </select>
          </div>
        </div>

        <PropertyFilterBuilder
          filters={propertyFilters}
          availableFields={availableFields}
          onChange={setPropertyFilters}
        />

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
              setGroupMode('property');
              setTimeBucket('day');
              setSortField('value');
              setSortDirection('desc');
              setPageSize(25);
              setAggregationField('');
              setAggregation('count');
              setPropertyFilters([]);
              router.replace('/query', { scroll: false });
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
              config: buildQueryState(1),
            }}
            buttonLabel="Save Current View"
          />
          <QueryExportActions
            rows={result?.results ?? []}
            applicationName={selectedApp?.name}
            eventName={eventName || undefined}
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
              {chartEligibility.eligible ? (
                <select
                  value={chartType}
                  onChange={(e) =>
                    setChartType(e.target.value as QueryResultChartType)
                  }
                  className={`${selectInputClass} h-8 min-w-32 py-1`}
                  style={selectChevronStyle}
                  aria-label="Chart type"
                >
                  <option value="auto">Auto chart</option>
                  <option value="bar">Bar chart</option>
                  <option value="line">Line chart</option>
                  <option value="area">Area chart</option>
                </select>
              ) : null}
            </div>
          </div>

          {chartView === 'chart' && chartEligibility.eligible ? (
            <div className="bg-white border border-[#E8E8E8] p-6">
              <QueryResultChart
                results={result.results}
                labelKey={labelKey}
                valueKey={valueKey}
                chartType={chartType}
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

          {result.pagination && result.pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#7A7A7A]">
                Showing page {result.pagination.page} of{' '}
                {result.pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void runQuery(result.pagination!.page - 1)}
                  disabled={result.pagination.page === 1 || loading}
                  className="flex h-9 w-9 items-center justify-center border border-[#E8E8E8] bg-white text-[#7A7A7A] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Previous results page"
                >
                  ‹
                </button>
                <span className="min-w-16 text-center text-sm font-medium text-[#0D0D0D]">
                  {result.pagination.page}
                </span>
                <button
                  type="button"
                  onClick={() => void runQuery(result.pagination!.page + 1)}
                  disabled={
                    result.pagination.page === result.pagination.totalPages ||
                    loading
                  }
                  className="flex h-9 w-9 items-center justify-center border border-[#E8E8E8] bg-white text-[#0D0D0D] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Next results page"
                >
                  ›
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
