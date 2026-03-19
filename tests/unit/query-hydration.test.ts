import { describe, expect, it } from 'vitest';
import {
  deserializeQueryStateFromSearchParams,
  serializeQueryStateToQueryString,
} from '@/lib/query/hydration';

describe('query hydration', () => {
  it('serializes and deserializes full query state', () => {
    const queryString = serializeQueryStateToQueryString({
      applicationId: 'app_123',
      eventName: 'purchase',
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-03-31T23:59:59.999Z',
      aggregation: 'sum',
      aggregationField: 'amount',
      groupBy: { kind: 'time', bucket: 'day' },
      sort: { field: 'group', direction: 'asc' },
      page: 2,
      pageSize: 50,
      limit: 500,
      propertyFilters: [
        {
          key: 'currency',
          valueType: 'string',
          operator: 'eq',
          value: 'USD',
        },
        {
          key: 'amount',
          valueType: 'number',
          operator: 'gt',
          value: 100,
          logic: 'and',
        },
      ],
    });

    const hydrated = deserializeQueryStateFromSearchParams(queryString);

    expect(hydrated).toEqual({
      applicationId: 'app_123',
      eventName: 'purchase',
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-03-31T23:59:59.999Z',
      aggregation: 'sum',
      aggregationField: 'amount',
      groupBy: { kind: 'time', bucket: 'day' },
      sort: { field: 'group', direction: 'asc' },
      page: 2,
      pageSize: 50,
      limit: 500,
      propertyFilters: [
        {
          key: 'currency',
          valueType: 'string',
          operator: 'eq',
          value: 'USD',
        },
        {
          key: 'amount',
          valueType: 'number',
          operator: 'gt',
          value: 100,
          logic: 'and',
        },
      ],
    });
  });

  it('keeps valid keys and drops invalid structured state', () => {
    const hydrated = deserializeQueryStateFromSearchParams(
      '?applicationId=app_123&propertyFilters=not-json',
    );

    expect(hydrated).toEqual({ applicationId: 'app_123' });
  });
});
