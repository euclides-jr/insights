/**
 * API Webhook Alerts Endpoint Tests
 *
 * Tests for GET/POST /api/webhooks, GET/PATCH/DELETE /api/webhooks/:id,
 * and POST /api/webhooks/:id/test
 *
 * Requires a running server and seeded database:
 *   bun run dev  (in another terminal)
 *   bun prisma db seed
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sessionFetch as fetch } from './helpers/session';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.TEST_API_KEY || 'demo_app_key_123';

let applicationId: string;
const createdWebhookIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeAll(async () => {
  const res = await fetch(`${API_BASE_URL}/api/applications`);
  expect(res.status).toBe(200);
  const body: { applications: { id: string; apiKey: string }[] } =
    await res.json();
  const demo = body.applications.find((a) => a.apiKey === TEST_API_KEY);
  expect(demo).toBeDefined();
  applicationId = demo!.id;
});

afterAll(async () => {
  await Promise.all(
    createdWebhookIds.map((id) =>
      fetch(`${API_BASE_URL}/api/webhooks/${id}`, { method: 'DELETE' }),
    ),
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function uniqueName() {
  return `test_webhook_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function createWebhook(overrides: Record<string, unknown> = {}) {
  const res = await fetch(`${API_BASE_URL}/api/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      applicationId,
      name: uniqueName(),
      url: 'https://webhook.site/test-eventpulse',
      minLevel: 'error',
      isActive: true,
      ...overrides,
    }),
  });
  const data = await res.json();
  if (res.status === 201 && data.id) createdWebhookIds.push(data.id);
  return { res, data };
}

// ---------------------------------------------------------------------------
// GET /api/webhooks
// ---------------------------------------------------------------------------
describe('GET /api/webhooks', () => {
  it('returns 200 with webhooks array and pagination metadata', async () => {
    const res = await fetch(`${API_BASE_URL}/api/webhooks`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.webhooks)).toBe(true);
    expect(typeof data.totalCount).toBe('number');
    expect(typeof data.page).toBe('number');
    expect(typeof data.pageSize).toBe('number');
  });

  it('filters by applicationId', async () => {
    await createWebhook();

    const res = await fetch(
      `${API_BASE_URL}/api/webhooks?applicationId=${applicationId}`,
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.webhooks)).toBe(true);
    expect(data.webhooks.length).toBeGreaterThan(0);
    for (const wh of data.webhooks) {
      expect(wh.applicationId).toBe(applicationId);
    }
  });

  it('supports pagination params', async () => {
    const res = await fetch(`${API_BASE_URL}/api/webhooks?page=1&pageSize=2`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.webhooks.length).toBeLessThanOrEqual(2);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(2);
  });

  it('includes application info in each webhook row', async () => {
    await createWebhook();

    const res = await fetch(
      `${API_BASE_URL}/api/webhooks?applicationId=${applicationId}`,
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.webhooks.length).toBeGreaterThan(0);
    const first = data.webhooks[0];
    expect(first.application).toBeDefined();
    expect(first.application.id).toBeDefined();
    expect(first.application.name).toBeDefined();
  });

  it('redacts webhook secrets in the list', async () => {
    await createWebhook({ secret: 'super-secret-value' });

    const res = await fetch(
      `${API_BASE_URL}/api/webhooks?applicationId=${applicationId}`,
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    for (const wh of data.webhooks) {
      if (wh.secret !== null) {
        expect(wh.secret).toBe('••••••••');
        expect(wh.secret).not.toContain('super-secret');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/webhooks
// ---------------------------------------------------------------------------
describe('POST /api/webhooks', () => {
  it('creates a webhook and returns 201 with expected shape', async () => {
    const { res, data } = await createWebhook();

    expect(res.status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.applicationId).toBe(applicationId);
    expect(typeof data.name).toBe('string');
    expect(typeof data.url).toBe('string');
    expect(data.isActive).toBe(true);
    expect(data.minLevel).toBe('error');
    expect(data.application).toBeDefined();
  });

  it('accepts warning as minLevel', async () => {
    const { res, data } = await createWebhook({ minLevel: 'warning' });
    expect(res.status).toBe(201);
    expect(data.minLevel).toBe('warning');
  });

  it('stores a secret and redacts it in the response', async () => {
    const { res, data } = await createWebhook({ secret: 'mysecret123' });
    expect(res.status).toBe(201);
    expect(data.secret).toBe('••••••••');
  });

  it('returns null secret when no secret is provided', async () => {
    const { res, data } = await createWebhook();
    expect(res.status).toBe(201);
    expect(data.secret).toBeNull();
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await fetch(`${API_BASE_URL}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
    expect(Array.isArray(data.details)).toBe(true);
  });

  it('returns 400 for an invalid URL', async () => {
    const res = await fetch(`${API_BASE_URL}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        name: uniqueName(),
        url: 'not-a-url',
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Validation failed');
  });

  it('returns 400 for an invalid minLevel value', async () => {
    const res = await fetch(`${API_BASE_URL}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        name: uniqueName(),
        url: 'https://webhook.site/test',
        minLevel: 'critical',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when applicationId does not exist', async () => {
    const res = await fetch(`${API_BASE_URL}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: '00000000-0000-0000-0000-000000000000',
        name: uniqueName(),
        url: 'https://webhook.site/test',
      }),
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// GET /api/webhooks/:id
// ---------------------------------------------------------------------------
describe('GET /api/webhooks/:id', () => {
  it('returns a single webhook by id', async () => {
    const { data: created } = await createWebhook();
    const res = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.id).toBe(created.id);
    expect(data.applicationId).toBe(applicationId);
    expect(data.application).toBeDefined();
  });

  it('redacts the secret on single fetch', async () => {
    const { data: created } = await createWebhook({ secret: 'topsecret' });
    const res = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.secret).toBe('••••••••');
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/webhooks/00000000-0000-0000-0000-000000000000`,
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/not found/i);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/webhooks/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/webhooks/:id', () => {
  it('updates name and url', async () => {
    const { data: created } = await createWebhook();
    const newName = uniqueName();

    const res = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        url: 'https://update.example.com/hook',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe(newName);
    expect(data.url).toBe('https://update.example.com/hook');
  });

  it('can disable a webhook via isActive: false', async () => {
    const { data: created } = await createWebhook();
    const res = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isActive).toBe(false);
  });

  it('can change minLevel to warning', async () => {
    const { data: created } = await createWebhook({ minLevel: 'error' });
    const res = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minLevel: 'warning' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.minLevel).toBe('warning');
  });

  it('can clear the secret by setting it to null', async () => {
    const { data: created } = await createWebhook({ secret: 'remove-me' });
    const res = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: null }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.secret).toBeNull();
  });

  it('returns 400 for an invalid URL on update', async () => {
    const { data: created } = await createWebhook();
    const res = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'bad-url' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/webhooks/00000000-0000-0000-0000-000000000000`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ghost' }),
      },
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/webhooks/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/webhooks/:id', () => {
  it('deletes a webhook and returns 204', async () => {
    const { data: created } = await createWebhook();
    // Remove from cleanup list — we're deleting it here
    const idx = createdWebhookIds.indexOf(created.id);
    if (idx !== -1) createdWebhookIds.splice(idx, 1);

    const res = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(204);
  });

  it('returns 404 after deletion', async () => {
    const { data: created } = await createWebhook();
    const idx = createdWebhookIds.indexOf(created.id);
    if (idx !== -1) createdWebhookIds.splice(idx, 1);

    await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`, {
      method: 'DELETE',
    });

    const res = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/webhooks/00000000-0000-0000-0000-000000000000`,
      { method: 'DELETE' },
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/webhooks/:id/test
// ---------------------------------------------------------------------------
describe('POST /api/webhooks/:id/test', () => {
  it('returns 404 for a non-existent webhook id', async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/webhooks/00000000-0000-0000-0000-000000000000/test`,
      { method: 'POST' },
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/not found/i);
  });

  it('returns the test result shape (network error expected for dummy url)', async () => {
    const { data: created } = await createWebhook({
      url: 'https://0.0.0.0/unreachable-test-endpoint',
    });

    const res = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}/test`, {
      method: 'POST',
    });
    // Should still return 200 from our API (result object, not webhook delivery status)
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.success).toBe('boolean');
    expect(typeof data.status).toBe('number');
    expect(data.payload).toBeDefined();
    expect(data.payload.event).toBe('quality.alert');
    expect(data.payload.applicationId).toBe(applicationId);
  });

  it('updates lastTriggeredAt after test delivery', async () => {
    const { data: created } = await createWebhook({
      url: 'https://0.0.0.0/unreachable-test-endpoint',
    });

    // Before test — lastTriggeredAt should be null
    const beforeRes = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`);
    const before = await beforeRes.json();
    expect(before.lastTriggeredAt).toBeNull();

    // Trigger test
    await fetch(`${API_BASE_URL}/api/webhooks/${created.id}/test`, {
      method: 'POST',
    });

    // After test — lastTriggeredAt should be set
    const afterRes = await fetch(`${API_BASE_URL}/api/webhooks/${created.id}`);
    const after = await afterRes.json();
    expect(after.lastTriggeredAt).not.toBeNull();
  });
});
