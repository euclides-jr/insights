/**
 * User Attributes API Tests
 *
 * Tests for POST /api/users/identify, GET /api/users/:userId,
 * POST /api/users/identify/batch, GET /api/users,
 * POST /api/users/query, GET /api/users/:userId/history,
 * GET|POST /api/users/attributes/schema
 *
 * Requires a running server and seeded database:
 *   bun run dev  (in another terminal)
 *   bun prisma db seed
 *
 * SC-008 Concurrency: 20 parallel identify requests for the same userId
 * must result in all attribute keys being present in the final profile.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.TEST_API_KEY || 'demo_app_key_123';

const HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': TEST_API_KEY,
};

// ─── Test-run-scoped user ID helpers ──────────────────────────────────────────

function runId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function testUserId(label: string) {
  return `test_user_${label}_${runId()}`;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Verify the server is reachable and the API key is valid
  const res = await fetch(`${API_BASE_URL}/api/applications`);
  expect(res.status).toBe(200);
});

// ---------------------------------------------------------------------------
// POST /api/users/identify
// ---------------------------------------------------------------------------

describe('POST /api/users/identify', () => {
  it('creates a new user profile with attributes', async () => {
    const userId = testUserId('create');
    const res = await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        userId,
        attributes: { plan: 'pro', country: 'US' },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.userId).toBe(userId);
    expect((data.attributes as Record<string, unknown>).plan).toBe('pro');
    expect((data.attributes as Record<string, unknown>).country).toBe('US');
  });

  it('merges new attributes without removing existing ones', async () => {
    const userId = testUserId('merge');
    // First identify
    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        userId,
        attributes: { plan: 'free', region: 'EU' },
      }),
    });
    // Second identify — update plan only
    const res2 = await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ userId, attributes: { plan: 'pro' } }),
    });
    expect(res2.status).toBe(200);
    const data = await res2.json();
    const attrs = data.attributes as Record<string, unknown>;
    expect(attrs.plan).toBe('pro');
    expect(attrs.region).toBe('EU'); // must still be present
  });

  it('normalizes attribute keys to lowercase', async () => {
    const userId = testUserId('lowercase');
    const res = await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ userId, attributes: { PlanType: 'enterprise' } }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    const attrs = data.attributes as Record<string, unknown>;
    expect(attrs.plantype).toBe('enterprise');
    expect(attrs.PlanType).toBeUndefined();
  });

  it('returns 400 when a reserved key is sent', async () => {
    const userId = testUserId('reserved');
    const res = await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        userId,
        attributes: { first_seen: '2024-01-01' },
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('returns 401 when X-API-Key header is missing', async () => {
    const res = await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'any', attributes: {} }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when X-API-Key is invalid', async () => {
    const res = await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'bad_key' },
      body: JSON.stringify({ userId: 'any', attributes: {} }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid request body', async () => {
    const res = await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ attributes: { plan: 'pro' } }), // missing userId
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// SC-008: Concurrent writes — last-write-wins / no lost writes (T029)
// ---------------------------------------------------------------------------

describe('Concurrent identify requests (SC-008)', () => {
  it('fires 20 parallel identify requests with non-overlapping keys and verifies all keys survive', async () => {
    const userId = testUserId('concurrent');
    const parallelCount = 20;

    // Each request sets a unique attribute key so there is no contention
    // between values — we purely test that all rows merge without data loss.
    const requests = Array.from({ length: parallelCount }, (_, i) =>
      fetch(`${API_BASE_URL}/api/users/identify`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          userId,
          attributes: { [`attr_${i}`]: `value_${i}` },
        }),
      }),
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);
    // Every request must succeed
    expect(statuses.every((s) => s === 200)).toBe(true);

    // Fetch the final profile and verify all 20 attribute keys are present
    const profileRes = await fetch(
      `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}`,
      {
        headers: HEADERS,
      },
    );
    expect(profileRes.status).toBe(200);
    const profile = await profileRes.json();
    const attrs = profile.attributes as Record<string, unknown>;

    for (let i = 0; i < parallelCount; i++) {
      expect(attrs[`attr_${i}`]).toBe(`value_${i}`);
    }
  }, 30_000); // 30 s timeout — allows for DB contention resolution

  it('fires 20 parallel identify requests for the SAME key and the final value equals one of the submitted values (last-write-wins)', async () => {
    const userId = testUserId('lww');
    const parallelCount = 20;

    const requests = Array.from({ length: parallelCount }, (_, i) =>
      fetch(`${API_BASE_URL}/api/users/identify`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          userId,
          attributes: { shared_key: `write_${i}` },
        }),
      }),
    );

    await Promise.all(requests);

    const profileRes = await fetch(
      `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}`,
      { headers: HEADERS },
    );
    expect(profileRes.status).toBe(200);
    const profile = await profileRes.json();
    const attrs = profile.attributes as Record<string, unknown>;

    // The value must be one of the submitted values (last-write-wins)
    const validValues = Array.from(
      { length: parallelCount },
      (_, i) => `write_${i}`,
    );
    expect(validValues).toContain(attrs.shared_key);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// GET /api/users/:userId
// ---------------------------------------------------------------------------

describe('GET /api/users/:userId', () => {
  it('returns user profile with attributes', async () => {
    const userId = testUserId('get');
    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ userId, attributes: { tier: 'gold' } }),
    });

    const res = await fetch(
      `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}`,
      {
        headers: HEADERS,
      },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.userId).toBe(userId);
    expect((data.attributes as Record<string, unknown>).tier).toBe('gold');
  });

  it('returns 404 for unknown userId', async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/users/nonexistent_user_xyz_abc`,
      {
        headers: HEADERS,
      },
    );
    expect(res.status).toBe(404);
  });

  it('includes history when ?includeHistory=true', async () => {
    const userId = testUserId('history');
    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ userId, attributes: { plan: 'free' } }),
    });
    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ userId, attributes: { plan: 'pro' } }),
    });

    const res = await fetch(
      `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}?includeHistory=true`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.history)).toBe(true);
    expect(data.history.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// POST /api/users/identify/batch
// ---------------------------------------------------------------------------

describe('POST /api/users/identify/batch', () => {
  it('processes multiple users in a single request', async () => {
    const users = Array.from({ length: 5 }, (_, i) => ({
      userId: testUserId(`batch_${i}`),
      attributes: { index: i, batch: true },
    }));

    const res = await fetch(`${API_BASE_URL}/api/users/identify/batch`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(users),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(5);
    expect(data.failed).toBe(0);
  });

  it('returns 400 when batch exceeds 100 items', async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ userId: `u_${i}` }));
    const res = await fetch(`${API_BASE_URL}/api/users/identify/batch`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(items),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/users (list with attribute filters)
// ---------------------------------------------------------------------------

describe('GET /api/users', () => {
  it('returns a paginated list of users', async () => {
    const res = await fetch(`${API_BASE_URL}/api/users`, {
      headers: HEADERS,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.users)).toBe(true);
    expect(typeof data.pagination).toBe('object');
  });

  it('filters users by attribute equality', async () => {
    const userId = testUserId('filter');
    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ userId, attributes: { filter_plan: 'platinum' } }),
    });

    const filters = JSON.stringify([
      { key: 'filter_plan', operator: 'eq', value: 'platinum', logic: 'and' },
    ]);
    const res = await fetch(
      `${API_BASE_URL}/api/users?filters=${encodeURIComponent(filters)}`,
      {
        headers: HEADERS,
      },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    const found = (data.users as { userId: string }[]).find(
      (u) => u.userId === userId,
    );
    expect(found).toBeDefined();
  });

  it('returns 400 for malformed filter JSON', async () => {
    const res = await fetch(`${API_BASE_URL}/api/users?filters=not_json`, {
      headers: HEADERS,
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/users/query (combined attribute + event filters)
// ---------------------------------------------------------------------------

describe('POST /api/users/query', () => {
  it('returns users matching attribute filters via POST', async () => {
    const userId = testUserId('query');
    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ userId, attributes: { query_plan: 'diamond' } }),
    });

    const res = await fetch(`${API_BASE_URL}/api/users/query`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        filters: [
          { key: 'query_plan', operator: 'eq', value: 'diamond', logic: 'and' },
        ],
        eventFilters: [],
        page: 1,
        pageSize: 50,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.users)).toBe(true);
    const found = (data.users as { userId: string }[]).find(
      (u) => u.userId === userId,
    );
    expect(found).toBeDefined();
  });

  it('returns 400 for invalid body', async () => {
    const res = await fetch(`${API_BASE_URL}/api/users/query`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ page: 'not_a_number' }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/users/:userId/history
// ---------------------------------------------------------------------------

describe('GET /api/users/:userId/history', () => {
  it('returns attribute change history', async () => {
    const userId = testUserId('hist');
    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ userId, attributes: { hist_plan: 'starter' } }),
    });
    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ userId, attributes: { hist_plan: 'growth' } }),
    });

    const res = await fetch(
      `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/history`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.history)).toBe(true);
    expect(data.history.length).toBeGreaterThan(0);
    const planChanges = (data.history as { attributeKey: string }[]).filter(
      (h) => h.attributeKey === 'hist_plan',
    );
    expect(planChanges.length).toBeGreaterThanOrEqual(1);
  });

  it('filters history by attributeKey', async () => {
    const userId = testUserId('histkey');
    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        userId,
        attributes: { key_a: 'v1', key_b: 'v1' },
      }),
    });
    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ userId, attributes: { key_a: 'v2' } }),
    });

    const res = await fetch(
      `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/history?attributeKey=key_a`,
      { headers: HEADERS },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    const keys = (data.history as { attributeKey: string }[]).map(
      (h) => h.attributeKey,
    );
    expect(keys.every((k) => k === 'key_a')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET|POST /api/users/attributes/schema
// ---------------------------------------------------------------------------

describe('/api/users/attributes/schema', () => {
  it('registers an attribute schema (POST) and retrieves it (GET)', async () => {
    const key = `test_attr_${runId()}`;
    const postRes = await fetch(`${API_BASE_URL}/api/users/attributes/schema`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        attributeKey: key,
        valueType: 'STRING',
        isIndexed: false,
      }),
    });
    expect(postRes.status).toBe(201);
    const postData = await postRes.json();
    expect(postData.schema.attributeKey).toBe(key);

    const getRes = await fetch(`${API_BASE_URL}/api/users/attributes/schema`, {
      headers: HEADERS,
    });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    const found = (getData.schemas as { attributeKey: string }[]).find(
      (s) => s.attributeKey === key,
    );
    expect(found).toBeDefined();
  });
});
