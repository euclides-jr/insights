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

import { describe, it, expect, beforeAll } from 'vitest';
import { sessionFetch } from './helpers/session';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.TEST_API_KEY || 'demo_app_key_123';
const rawFetch = globalThis.fetch;
const fetch = (input: string, init?: RequestInit) =>
  input.includes('/api/users/identify') || input.includes('/api/events')
    ? rawFetch(input, init)
    : sessionFetch(input, init);
let applicationId: string;

const HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': TEST_API_KEY,
};

const SEEDED_COMBO_USERS = {
  powerBuyer: 'seed_combo_power_buyer',
  trialExplorer: 'seed_combo_trial_explorer',
  trialBuyer: 'seed_combo_trial_buyer',
  canadaReader: 'seed_combo_canada_reader',
  inactiveEnterprise: 'seed_combo_inactive_enterprise',
};

// ─── Test-run-scoped user ID helpers ──────────────────────────────────────────

function runId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function testUserId(label: string) {
  return `test_user_${label}_${runId()}`;
}

function userProfileUrl(userId: string, extraParams?: Record<string, string>) {
  const params = new URLSearchParams({ applicationId });
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      params.set(key, value);
    }
  }
  return `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}?${params}`;
}

function userHistoryUrl(userId: string, extraParams?: Record<string, string>) {
  const params = new URLSearchParams({ applicationId });
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      params.set(key, value);
    }
  }
  return `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/history?${params}`;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const res = await fetch(`${API_BASE_URL}/api/applications`);
  expect(res.status).toBe(200);
  const body: { applications: { id: string; apiKey: string }[] } = await res.json();
  const demo = body.applications.find((a) => a.apiKey === TEST_API_KEY);
  expect(demo).toBeDefined();
  applicationId = demo!.id;
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

  it('returns 401 when only a dashboard session is present', async () => {
    const res = await sessionFetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'any', attributes: {} }),
    });
    expect(res.status).toBe(401);
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
    const profileRes = await fetch(userProfileUrl(userId));
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

    const profileRes = await fetch(userProfileUrl(userId));
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

    const res = await fetch(userProfileUrl(userId));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.userId).toBe(userId);
    expect((data.attributes as Record<string, unknown>).tier).toBe('gold');
  });

  it('returns 404 for unknown userId', async () => {
    const res = await fetch(
      userProfileUrl('nonexistent_user_xyz_abc'),
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
      userProfileUrl(userId, { includeHistory: 'true' }),
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
    const res = await fetch(`${API_BASE_URL}/api/users?applicationId=${applicationId}`);
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
      `${API_BASE_URL}/api/users?applicationId=${applicationId}&filters=${encodeURIComponent(filters)}`,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    const found = (data.users as { userId: string }[]).find(
      (u) => u.userId === userId,
    );
    expect(found).toBeDefined();
  });

  it('returns 400 for malformed filter JSON', async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/users?applicationId=${applicationId}&filters=not_json`,
    );
    expect(res.status).toBe(400);
  });

  it('supports seeded contains filters across company names', async () => {
    const filters = JSON.stringify([
      { key: 'company', operator: 'contains', value: 'Matrix', logic: 'and' },
    ]);
    const res = await fetch(
      `${API_BASE_URL}/api/users?applicationId=${applicationId}&filters=${encodeURIComponent(filters)}`,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    const userIds = (data.users as { userId: string }[]).map((user) => user.userId);

    expect(userIds).toContain(SEEDED_COMBO_USERS.powerBuyer);
    expect(userIds).toContain(SEEDED_COMBO_USERS.trialExplorer);
    expect(userIds).toContain(SEEDED_COMBO_USERS.trialBuyer);
    expect(userIds).toContain(SEEDED_COMBO_USERS.canadaReader);
    expect(userIds).toContain(SEEDED_COMBO_USERS.inactiveEnterprise);
  });

  it('returns 401 without a session for dashboard list routes', async () => {
    const res = await rawFetch(`${API_BASE_URL}/api/users?applicationId=${applicationId}`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Authentication required' });
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
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

  it('matches event behavior against the attribute state active at event time (FR-019)', async () => {
    const userId = testUserId('historical');
    const eventName = `historical_plan_event_${runId()}`;

    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        userId,
        attributes: { lifecycle_plan: 'pro' },
      }),
    });

    const eventTimestamp = new Date().toISOString();
    const eventRes = await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        eventName,
        userId,
        sessionId: `sess_${runId()}`,
        timestamp: eventTimestamp,
      }),
    });
    expect(eventRes.status).toBe(201);

    await new Promise((resolve) => setTimeout(resolve, 25));

    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        userId,
        attributes: { lifecycle_plan: 'enterprise' },
      }),
    });

    const proRes = await fetch(`${API_BASE_URL}/api/users/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        filters: [
          {
            key: 'lifecycle_plan',
            operator: 'eq',
            value: 'pro',
            logic: 'and',
          },
        ],
        eventFilters: [
          {
            eventName,
            operator: 'performed',
            count: { min: 1 },
            timeWindow: { value: 1, unit: 'days' },
          },
        ],
        page: 1,
        pageSize: 50,
      }),
    });
    expect(proRes.status).toBe(200);
    const proData = await proRes.json();
    const proMatch = (proData.users as { userId: string }[]).find(
      (u) => u.userId === userId,
    );
    expect(proMatch).toBeDefined();

    const enterpriseRes = await fetch(`${API_BASE_URL}/api/users/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        filters: [
          {
            key: 'lifecycle_plan',
            operator: 'eq',
            value: 'enterprise',
            logic: 'and',
          },
        ],
        eventFilters: [
          {
            eventName,
            operator: 'performed',
            count: { min: 1 },
            timeWindow: { value: 1, unit: 'days' },
          },
        ],
        page: 1,
        pageSize: 50,
      }),
    });
    expect(enterpriseRes.status).toBe(200);
    const enterpriseData = await enterpriseRes.json();
    const enterpriseMatch = (enterpriseData.users as { userId: string }[]).find(
      (u) => u.userId === userId,
    );
    expect(enterpriseMatch).toBeUndefined();
  });

  it('accepts event count filters using the schema count object shape', async () => {
    const userId = testUserId('eventcount');
    const eventName = `purchase_count_${runId()}`;

    await fetch(`${API_BASE_URL}/api/users/identify`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        userId,
        attributes: { plan: 'pro' },
      }),
    });

    const firstEventRes = await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        eventName,
        userId,
        sessionId: `sess_${runId()}`,
      }),
    });
    expect(firstEventRes.status).toBe(201);

    const secondEventRes = await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        eventName,
        userId,
        sessionId: `sess_${runId()}`,
      }),
    });
    expect(secondEventRes.status).toBe(201);

    const res = await fetch(`${API_BASE_URL}/api/users/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        filters: [{ key: 'plan', operator: 'eq', value: 'pro', logic: 'and' }],
        eventFilters: [
          {
            eventName,
            operator: 'performed',
            count: { min: 2 },
            timeWindow: { value: 1, unit: 'days' },
          },
        ],
        page: 1,
        pageSize: 50,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(
      (data.users as { userId: string }[]).some((candidate) => candidate.userId === userId),
    ).toBe(true);
  });

  it('returns seeded buyers who purchased at least twice within 7 days', async () => {
    const res = await fetch(`${API_BASE_URL}/api/users/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        filters: [
          { key: 'company', operator: 'contains', value: 'Matrix', logic: 'and' },
          { key: 'plan', operator: 'eq', value: 'pro', logic: 'and' },
        ],
        eventFilters: [
          {
            eventName: 'purchase',
            operator: 'performed',
            count: { min: 2 },
            timeWindow: { value: 7, unit: 'days' },
          },
        ],
        page: 1,
        pageSize: 50,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const userIds = (data.users as { userId: string }[]).map((user) => user.userId);

    expect(userIds).toContain(SEEDED_COMBO_USERS.powerBuyer);
    expect(userIds).not.toContain(SEEDED_COMBO_USERS.trialExplorer);
    expect(userIds).not.toContain(SEEDED_COMBO_USERS.canadaReader);
  });

  it('returns seeded trial buyers and excludes seeded trial explorers for starter purchase queries', async () => {
    const res = await fetch(`${API_BASE_URL}/api/users/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        filters: [
          { key: 'plan', operator: 'eq', value: 'starter', logic: 'and' },
          { key: 'company', operator: 'contains', value: 'Query Matrix', logic: 'and' },
        ],
        eventFilters: [
          {
            eventName: 'purchase',
            operator: 'performed',
            count: { min: 1 },
            timeWindow: { value: 7, unit: 'days' },
          },
        ],
        page: 1,
        pageSize: 50,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const userIds = (data.users as { userId: string }[]).map((user) => user.userId);

    expect(userIds).toContain(SEEDED_COMBO_USERS.trialBuyer);
    expect(userIds).not.toContain(SEEDED_COMBO_USERS.trialExplorer);
  });

  it('supports OR attribute filters across seeded countries', async () => {
    const res = await fetch(`${API_BASE_URL}/api/users/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        filters: [
          { key: 'country', operator: 'eq', value: 'US', logic: 'and' },
          { key: 'country', operator: 'eq', value: 'CA', logic: 'or' },
        ],
        eventFilters: [],
        page: 1,
        pageSize: 50,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const userIds = (data.users as { userId: string }[]).map((user) => user.userId);

    expect(userIds).toContain(SEEDED_COMBO_USERS.powerBuyer);
    expect(userIds).toContain(SEEDED_COMBO_USERS.canadaReader);
    expect(userIds).not.toContain(SEEDED_COMBO_USERS.trialExplorer);
  });

  it('returns 400 for invalid body', async () => {
    const res = await fetch(`${API_BASE_URL}/api/users/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, page: 'not_a_number' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without a session for dashboard queries', async () => {
    const res = await rawFetch(`${API_BASE_URL}/api/users/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        filters: [],
        eventFilters: [],
        page: 1,
        pageSize: 10,
      }),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Authentication required' });
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
      userHistoryUrl(userId),
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
      userHistoryUrl(userId, { attributeKey: 'key_a' }),
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        attributeKey: key,
        valueType: 'STRING',
        isIndexed: false,
      }),
    });
    expect(postRes.status).toBe(201);
    const postData = await postRes.json();
    expect(postData.schema.attributeKey).toBe(key);

    const getRes = await fetch(
      `${API_BASE_URL}/api/users/attributes/schema?applicationId=${applicationId}`,
    );
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    const found = (getData.schemas as { attributeKey: string }[]).find(
      (s) => s.attributeKey === key,
    );
    expect(found).toBeDefined();
  });

  it('returns 401 without a session for dashboard schema routes', async () => {
    const res = await rawFetch(
      `${API_BASE_URL}/api/users/attributes/schema?applicationId=${applicationId}`,
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Authentication required' });
  });
});
