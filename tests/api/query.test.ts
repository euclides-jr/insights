/**
 * API Query Endpoint Tests
 *
 * Tests for POST /api/query endpoint
 * Run with: bun test tests/api/query.test.ts
 *
 * Requires a running server and seeded database:
 *   bun run dev  (in another terminal)
 *   bun prisma db seed
 */

import { describe, it, expect, beforeAll } from 'vitest';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.TEST_API_KEY || 'demo_app_key_123'; // From seed

// Date range that covers all seed events
const START_DATE = '2020-01-01T00:00:00.000Z';
const END_DATE = '2030-12-31T23:59:59.000Z';

let applicationId: string;

// ---------------------------------------------------------------------------
// Setup: resolve applicationId for the demo app
// ---------------------------------------------------------------------------
beforeAll(async () => {
  const res = await fetch(`${API_BASE_URL}/api/applications`);
  expect(res.status).toBe(200);
  const body: { applications: { id: string; name: string; apiKey: string }[] } =
    await res.json();
  const demo = body.applications.find((a) => a.apiKey === TEST_API_KEY);
  expect(demo).toBeDefined();
  applicationId = demo!.id;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function post(body: object, apiKey = TEST_API_KEY) {
  return fetch(`${API_BASE_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
describe('GET /api/query', () => {
  it('should return service info', async () => {
    const res = await fetch(`${API_BASE_URL}/api/query`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.service).toBe('Event Query API');
    expect(data.supportedAggregations).toContain('count');
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/query — Authentication', () => {
  it('should return 401 when X-API-Key is missing', async () => {
    const res = await fetch(`${API_BASE_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: 'any',
        startDate: START_DATE,
        endDate: END_DATE,
      }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Missing X-API-Key header');
  });

  it('should return 401 when API key is invalid', async () => {
    const res = await post(
      { applicationId: 'any', startDate: START_DATE, endDate: END_DATE },
      'invalid_key_xyz',
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid API key');
  });

  it('should return 403 when applicationId does not belong to the API key', async () => {
    const res = await post({
      applicationId: '00000000-0000-0000-0000-000000000000',
      startDate: START_DATE,
      endDate: END_DATE,
    });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Access denied');
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/query — Validation', () => {
  it('should return 400 when applicationId is missing', async () => {
    const res = await post({ startDate: START_DATE, endDate: END_DATE });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 when startDate is missing', async () => {
    const res = await post({ applicationId, endDate: END_DATE });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 when endDate is missing', async () => {
    const res = await post({ applicationId, startDate: START_DATE });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 when endDate is before startDate', async () => {
    const res = await post({
      applicationId,
      startDate: END_DATE,
      endDate: START_DATE,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('endDate must be after startDate');
  });

  it('should return 400 when startDate is not ISO 8601', async () => {
    const res = await post({
      applicationId,
      startDate: 'not-a-date',
      endDate: END_DATE,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 when limit exceeds 10000', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      limit: 99999,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 when aggregation value is invalid', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      aggregation: 'median', // not supported
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 when groupBy uses an invalid property key', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      groupBy: 'bad key!', // spaces and punctuation not allowed
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Invalid property key/);
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/query — Count aggregation', () => {
  it('should return a count for all events in the date range', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      aggregation: 'count',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(typeof data.results[0].value).toBe('number');
    expect(data.results[0].value).toBeGreaterThanOrEqual(0);
    expect(typeof data.executionTimeMs).toBe('number');
    expect(data.totalCount).toBe(1);
  });

  it('should return count filtered by eventName', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      eventName: 'purchase',
      aggregation: 'count',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results[0].value).toBeGreaterThanOrEqual(0);
  });

  it('should return 0 count for a date range with no events', async () => {
    const res = await post({
      applicationId,
      startDate: '2000-01-01T00:00:00.000Z',
      endDate: '2000-01-02T00:00:00.000Z',
      aggregation: 'count',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results[0].value).toBe(0);
  });

  it('should filter by a custom property via filters map', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      filters: { currency: 'USD' },
      aggregation: 'count',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.results[0].value).toBe('number');
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/query — Unique users aggregation', () => {
  it('should return count of distinct userIds', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      aggregation: 'unique_users',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results[0].value).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/query — Sum aggregation', () => {
  it('should return sum of a numeric property', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      eventName: 'purchase',
      aggregation: 'sum',
      aggregationField: 'amount',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    // value may be null if no purchase events have an amount; just check shape
    expect('value' in data.results[0]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/query — Avg aggregation', () => {
  it('should return average of a numeric property', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      eventName: 'purchase',
      aggregation: 'avg',
      aggregationField: 'amount',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect('value' in data.results[0]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/query — GroupBy', () => {
  it('should group count results by a property', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      eventName: 'purchase',
      aggregation: 'count',
      groupBy: 'currency',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    // Each result row should have (group, value) shape
    for (const row of data.results) {
      expect('group' in row).toBe(true);
      expect('value' in row).toBe(true);
    }
  });

  it('should group sum results by a property', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      eventName: 'purchase',
      aggregation: 'sum',
      aggregationField: 'amount',
      groupBy: 'currency',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const row of data.results) {
      expect('group' in row).toBe(true);
      expect('value' in row).toBe(true);
    }
  });

  it('should respect the limit parameter when grouping', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      aggregation: 'count',
      groupBy: 'currency',
      limit: 1,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeLessThanOrEqual(1);
  });

  it('supports time-bucket grouping', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      aggregation: 'count',
      groupBy: {
        kind: 'time',
        bucket: 'day',
      },
      pageSize: 5,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.pagination.pageSize).toBe(5);
    if (data.results.length > 0) {
      expect('group' in data.results[0]).toBe(true);
      expect('value' in data.results[0]).toBe(true);
    }
  });

  it('supports typed property filters', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      eventName: 'purchase',
      aggregation: 'count',
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
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(typeof data.results[0].value).toBe('number');
  });

  it('returns 400 for invalid typed property filter combinations', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
      propertyFilters: [
        {
          key: 'amount',
          valueType: 'number',
          operator: 'between',
          value: 10,
        },
      ],
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });
});

// ---------------------------------------------------------------------------
describe('POST /api/query — Response shape', () => {
  it('should always include results, totalCount and executionTimeMs', async () => {
    const res = await post({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.results)).toBe(true);
    expect(typeof data.totalCount).toBe('number');
    expect(typeof data.executionTimeMs).toBe('number');
    expect(data.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});
