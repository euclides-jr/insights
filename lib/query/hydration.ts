import {
  QueryDefinition,
  queryHydrationSchema,
} from '@/lib/validations/query-schemas';

type SearchParamInput =
  | URLSearchParams
  | string
  | Record<string, string | string[] | undefined>;

function toSearchParams(input: SearchParamInput) {
  if (input instanceof URLSearchParams) {
    return new URLSearchParams(input.toString());
  }

  if (typeof input === 'string') {
    return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }
    params.set(key, value);
  }
  return params;
}

function parseNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function omitUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export function serializeQueryStateToSearchParams(
  state: Partial<QueryDefinition>,
) {
  const params = new URLSearchParams();

  if (state.applicationId) params.set('applicationId', state.applicationId);
  if (state.eventName) params.set('eventName', state.eventName);
  if (state.startDate) params.set('startDate', state.startDate);
  if (state.endDate) params.set('endDate', state.endDate);
  if (state.aggregation) params.set('aggregation', state.aggregation);
  if (state.aggregationField) {
    params.set('aggregationField', state.aggregationField);
  }
  if (state.page) params.set('page', String(state.page));
  if (state.pageSize) params.set('pageSize', String(state.pageSize));
  if (state.limit) params.set('limit', String(state.limit));

  if (state.groupBy) {
    params.set('groupByKind', state.groupBy.kind);
    if (state.groupBy.kind === 'property') {
      params.set('groupByKey', state.groupBy.key);
    } else {
      params.set('groupByBucket', state.groupBy.bucket);
    }
  }

  if (state.sort) {
    params.set('sortField', state.sort.field);
    params.set('sortDirection', state.sort.direction);
  }

  if (state.propertyFilters && state.propertyFilters.length > 0) {
    params.set('propertyFilters', JSON.stringify(state.propertyFilters));
  }

  return params;
}

export function deserializeQueryStateFromSearchParams(
  input: SearchParamInput,
): Partial<QueryDefinition> {
  const params = toSearchParams(input);

  const propertyFiltersParam = params.get('propertyFilters');
  let propertyFilters: unknown;
  if (propertyFiltersParam) {
    try {
      propertyFilters = JSON.parse(propertyFiltersParam);
    } catch {
      propertyFilters = undefined;
    }
  }

  const groupByKind = params.get('groupByKind');
  const groupBy =
    groupByKind === 'property' && params.get('groupByKey')
      ? { kind: 'property' as const, key: params.get('groupByKey')! }
      : groupByKind === 'time' && params.get('groupByBucket')
        ? { kind: 'time' as const, bucket: params.get('groupByBucket') as QueryDefinition['groupBy'] extends { bucket: infer T } ? T : never }
        : undefined;

  const sortField = params.get('sortField');
  const sortDirection = params.get('sortDirection');
  const sort =
    sortField && sortDirection
      ? {
          field: sortField as 'group' | 'value',
          direction: sortDirection as 'asc' | 'desc',
        }
      : undefined;

  const hydrated = queryHydrationSchema.safeParse({
    applicationId: params.get('applicationId') ?? undefined,
    eventName: params.get('eventName') ?? undefined,
    startDate: params.get('startDate') ?? undefined,
    endDate: params.get('endDate') ?? undefined,
    aggregation: params.get('aggregation') ?? undefined,
    aggregationField: params.get('aggregationField') ?? undefined,
    page: parseNumber(params.get('page')),
    pageSize: parseNumber(params.get('pageSize')),
    limit: parseNumber(params.get('limit')),
    propertyFilters,
    groupBy,
    sort,
  });

  return hydrated.success ? omitUndefined(hydrated.data) : {};
}

export function serializeQueryStateToQueryString(
  state: Partial<QueryDefinition>,
) {
  return serializeQueryStateToSearchParams(state).toString();
}
