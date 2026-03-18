/**
 * API Segment Management Endpoint Tests
 *
 * Tests for GET/POST /api/segments and GET/PUT/DELETE /api/segments/:id
 * and GET /api/segments/:id/export
 *
 * Requires a running server and seeded database:
 *   bun run dev  (in another terminal)
 *   bun prisma db seed
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.TEST_API_KEY || 'demo_app_key_123';
const HEADERS = { 'Content-Type': 'application/json', 'X-API-Key': TEST_API_KEY };

let applicationId: string;
const createdSegmentIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeAll(async () => {
  const res = await fetch(`${API_BASE_URL}/api/applications`, { headers: HEADERS });
  expect(res.status).toBe(200);
  const body: { applications: { id: string; apiKey: string }[] } =
    await res.json();
  const demo = body.applications.find((a) => a.apiKey === TEST_API_KEY);
  expect(demo).toBeDefined();
  applicationId = demo!.id;
});

afterAll(async () => {
  await Promise.all(
    createdSegmentIds.map((id) =>
      fetch(`${API_BASE_URL}/api/segments/${id}`, { method: 'DELETE', headers: HEADERS }),
    ),
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function uniqueName() {
  return `test_segment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function createSegment(overrides: Record<string, unknown> = {}) {
  const res = await fetch(`${API_BASE_URL}/api/segments`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      applicationId,
      name: uniqueName(),
      criteria: {
        logic: 'AND',
        eventFilters: [{ eventName: 'page_view' }],
      },
      ...overrides,
    }),
  });
  const data = await res.json();
  if (res.status === 201 && data.id) createdSegmentIds.push(data.id);
  return { res, data };
}

// ---------------------------------------------------------------------------
// GET /api/segments
// ---------------------------------------------------------------------------
describe('GET /api/segments', () => {
  it('should return segments list with pagination metadata', async () => {
    const res = await fetch(`${API_BASE_URL}/api/segments`, { headers: HEADERS });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.segments)).toBe(true);
    expect(typeof data.totalCount).toBe('number');
    expect(typeof data.page).toBe('number');
    expect(typeof data.pageSize).toBe('number');
  });

  it('should filter by applicationId', async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/segments?applicationId=${applicationId}`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.segments)).toBe(true);
    for (const seg of data.segments) {
      expect(seg.applicationId).toBe(applicationId);
    }
  });

  it('should support pagination', async () => {
    const res = await fetch(`${API_BASE_URL}/api/segments?page=1&pageSize=2`, { headers: HEADERS });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.segments.length).toBeLessThanOrEqual(2);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(2);
  });

  it('each segment row should include application info', async () => {
    // Create one first to ensure there's at least one row
    await createSegment();

    const res = await fetch(
      `${API_BASE_URL}/api/segments?applicationId=${applicationId}`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.segments.length).toBeGreaterThan(0);
    const first = data.segments[0];
    expect(first.application).toBeDefined();
    expect(first.application.id).toBeDefined();
    expect(first.application.name).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/segments
// ---------------------------------------------------------------------------
describe('POST /api/segments', () => {
  it('should create a segment and return 201 with memberCount', async () => {
    const { res, data } = await createSegment();
    expect(res.status).toBe(201);
    expect(data.id).toBeDefined();
    expect(typeof data.memberCount).toBe('number');
    expect(data.estimatedRefreshTime).toBeDefined();
  });

  it('should return 400 for missing required fields', async () => {
    const res = await fetch(`${API_BASE_URL}/api/segments`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ applicationId }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 if eventFilters is empty', async () => {
    const res = await fetch(`${API_BASE_URL}/api/segments`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        applicationId,
        name: uniqueName(),
        criteria: { logic: 'AND', eventFilters: [] },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('should return 404 for unknown applicationId', async () => {
    const res = await fetch(`${API_BASE_URL}/api/segments`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        applicationId: '00000000-0000-0000-0000-000000000000',
        name: uniqueName(),
        criteria: {
          logic: 'AND',
          eventFilters: [{ eventName: 'page_view' }],
        },
      }),
    });
    expect(res.status).toBe(404);
  });

  it('should accept OR logic', async () => {
    const { res, data } = await createSegment({
      criteria: {
        logic: 'OR',
        eventFilters: [
          { eventName: 'page_view' },
          { eventName: 'button_click' },
        ],
      },
    });
    expect(res.status).toBe(201);
    expect(data.criteria.logic).toBe('OR');
  });

  it('should store count + timeWindow filters', async () => {
    const { res, data } = await createSegment({
      criteria: {
        logic: 'AND',
        eventFilters: [
          {
            eventName: 'page_view',
            count: { min: 1 },
            timeWindow: { value: 30, unit: 'days' },
          },
        ],
      },
    });
    expect(res.status).toBe(201);
    const filter = data.criteria.eventFilters[0];
    expect(filter.count.min).toBe(1);
    expect(filter.timeWindow.value).toBe(30);
    expect(filter.timeWindow.unit).toBe('days');
  });

  it('memberCount should reflect matching users in event data', async () => {
    // Send a known event so there is at least 1 user
    const userId = `test_user_${Date.now()}`;
    await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEST_API_KEY,
      },
      body: JSON.stringify({
        eventName: 'segment_test_event',
        userId,
        sessionId: 'sess1',
        properties: {},
      }),
    });

    const { res, data } = await createSegment({
      criteria: {
        logic: 'AND',
        eventFilters: [{ eventName: 'segment_test_event' }],
      },
    });
    expect(res.status).toBe(201);
    expect(data.memberCount).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/segments/:id
// ---------------------------------------------------------------------------
describe('GET /api/segments/:id', () => {
  it('should return a single segment with application', async () => {
    const { data: created } = await createSegment();
    const res = await fetch(`${API_BASE_URL}/api/segments/${created.id}`, { headers: HEADERS });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(created.id);
    expect(data.application).toBeDefined();
  });

  it('should return 404 for unknown id', async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/segments/00000000-0000-0000-0000-000000000000`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/segments/:id
// ---------------------------------------------------------------------------
describe('PUT /api/segments/:id', () => {
  it('should update name and description', async () => {
    const { data: created } = await createSegment();
    const newName = 'Updated ' + uniqueName();
    const res = await fetch(`${API_BASE_URL}/api/segments/${created.id}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({ name: newName, description: 'Updated desc' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe(newName);
    expect(data.description).toBe('Updated desc');
  });

  it('should refresh memberCount when refresh: true', async () => {
    const { data: created } = await createSegment();
    const res = await fetch(`${API_BASE_URL}/api/segments/${created.id}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({ refresh: true }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.memberCount).toBe('number');
    expect(data.lastRefreshedAt).toBeDefined();
  });

  it('should update criteria and recalculate memberCount', async () => {
    const { data: created } = await createSegment();
    const res = await fetch(`${API_BASE_URL}/api/segments/${created.id}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        criteria: {
          logic: 'OR',
          eventFilters: [{ eventName: 'page_view' }, { eventName: 'login' }],
        },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.criteria.logic).toBe('OR');
    expect(typeof data.memberCount).toBe('number');
  });

  it('should return 404 for unknown id', async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/segments/00000000-0000-0000-0000-000000000000`,
      {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ name: 'ghost' }),
      },
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/segments/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/segments/:id', () => {
  it('should delete a segment and return 204', async () => {
    const { data: created } = await createSegment();
    const res = await fetch(`${API_BASE_URL}/api/segments/${created.id}`, {
      method: 'DELETE',
      headers: HEADERS,
    });
    expect(res.status).toBe(204);

    // Remove from cleanup list (already deleted)
    const idx = createdSegmentIds.indexOf(created.id);
    if (idx !== -1) createdSegmentIds.splice(idx, 1);

    // Verify gone
    const getRes = await fetch(`${API_BASE_URL}/api/segments/${created.id}`, { headers: HEADERS });
    expect(getRes.status).toBe(404);
  });

  it('should return 404 for unknown id', async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/segments/00000000-0000-0000-0000-000000000000`,
      { method: 'DELETE', headers: HEADERS },
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/segments/:id/export
// ---------------------------------------------------------------------------
describe('GET /api/segments/:id/export', () => {
  it('should export JSON with users array', async () => {
    const { data: created } = await createSegment();
    const res = await fetch(
      `${API_BASE_URL}/api/segments/${created.id}/export?format=json`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.users)).toBe(true);
    expect(typeof data.segmentName).toBe('string');
    expect(typeof data.exportedAt).toBe('string');
    expect(typeof data.totalCount).toBe('number');
    expect(data.totalCount).toBe(data.users.length);
  });

  it('each exported user should have userId, lastEventDate, eventCount', async () => {
    // Create segment that should capture our test user from the event we sent above
    const { data: created } = await createSegment({
      criteria: {
        logic: 'AND',
        eventFilters: [{ eventName: 'segment_test_event' }],
      },
    });
    const res = await fetch(
      `${API_BASE_URL}/api/segments/${created.id}/export?format=json`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    if (data.users.length > 0) {
      const user = data.users[0];
      expect(typeof user.userId).toBe('string');
      expect(typeof user.lastEventDate).toBe('string');
      expect(typeof user.eventCount).toBe('number');
    }
  });

  it('should export CSV with correct headers', async () => {
    const { data: created } = await createSegment();
    const res = await fetch(
      `${API_BASE_URL}/api/segments/${created.id}/export?format=csv`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text.startsWith('userId,lastEventDate,eventCount')).toBe(true);
  });

  it('should return 400 for invalid format', async () => {
    const { data: created } = await createSegment();
    const res = await fetch(
      `${API_BASE_URL}/api/segments/${created.id}/export?format=xml`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(400);
  });

  it('should return 404 for unknown segment id on export', async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/segments/00000000-0000-0000-0000-000000000000/export`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(404);
  });
});
