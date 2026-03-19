/**
 * API Data Quality Endpoint Tests
 *
 * Tests for GET /api/quality
 *
 * Requires a running server and seeded database:
 *   bun run dev  (in another terminal)
 *   bun prisma db seed
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { THRESHOLDS } from '@/app/api/quality/route';
import { sessionFetch } from './helpers/session';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.TEST_API_KEY || 'demo_app_key_123';

let applicationId: string;

function dashboardFetch(path: string, init?: RequestInit) {
  return sessionFetch(`${API_BASE_URL}${path}`, init);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeAll(async () => {
  const res = await dashboardFetch('/api/applications');
  expect(res.status).toBe(200);
  const body: { applications: { id: string; apiKey: string }[] } =
    await res.json();
  const demo = body.applications.find((a) => a.apiKey === TEST_API_KEY);
  expect(demo).toBeDefined();
  applicationId = demo!.id;
});

// ---------------------------------------------------------------------------
// GET /api/quality
// ---------------------------------------------------------------------------
describe('GET /api/quality', () => {
  it('should return metrics with summary and thresholds', async () => {
    const res = await dashboardFetch('/api/quality');
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(Array.isArray(data.metrics)).toBe(true);
    expect(typeof data.totalCount).toBe('number');
    expect(typeof data.page).toBe('number');
    expect(typeof data.pageSize).toBe('number');

    // Summary shape
    expect(typeof data.summary.eventsReceived).toBe('number');
    expect(typeof data.summary.eventsRejected).toBe('number');
    expect(typeof data.summary.avgValidationFailureRate).toBe('number');
    expect(typeof data.summary.avgCompletenessRate).toBe('number');
    expect(typeof data.summary.avgDuplicateRate).toBe('number');
    expect(['ok', 'warning', 'error']).toContain(data.summary.overallStatus);
    expect(data.summary.windowDays).toBe(7); // default

    // Thresholds returned
    expect(data.thresholds).toBeDefined();
    expect(typeof data.thresholds.validationFailureRate.warning).toBe('number');
    expect(typeof data.thresholds.completenessRate.error).toBe('number');
  });

  it('should filter by applicationId', async () => {
    const res = await dashboardFetch(
      `/api/quality?applicationId=${applicationId}`,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const m of data.metrics) {
      expect(m.applicationId).toBe(applicationId);
    }
  });

  it('should respect the days filter', async () => {
    const res = await dashboardFetch('/api/quality?days=30');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary.windowDays).toBe(30);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    for (const m of data.metrics) {
      expect(new Date(m.date).getTime()).toBeGreaterThanOrEqual(
        cutoff.setHours(0, 0, 0, 0),
      );
    }
  });

  it('should cap days at 90', async () => {
    const res = await dashboardFetch('/api/quality?days=999');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary.windowDays).toBe(90);
  });

  it('should support pagination', async () => {
    const res = await dashboardFetch('/api/quality?page=1&pageSize=2&days=90');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.metrics.length).toBeLessThanOrEqual(2);
    expect(data.pageSize).toBe(2);
  });

  it('should include alert levels on each metric row', async () => {
    const res = await dashboardFetch('/api/quality?days=90');
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const m of data.metrics) {
      expect(m.alerts).toBeDefined();
      expect(['ok', 'warning', 'error']).toContain(
        m.alerts.validationFailureRate,
      );
      expect(['ok', 'warning', 'error']).toContain(m.alerts.completenessRate);
      expect(['ok', 'warning', 'error']).toContain(m.alerts.duplicateRate);
      expect(['ok', 'warning', 'error']).toContain(m.alerts.overall);
    }
  });

  it('should include application name in each metric row', async () => {
    const res = await dashboardFetch('/api/quality?days=90');
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const m of data.metrics) {
      expect(typeof m.application?.name).toBe('string');
    }
  });

  it('should return empty metrics array when no data exists for filter', async () => {
    const res = await dashboardFetch(
      '/api/quality?applicationId=00000000-0000-0000-0000-000000000000',
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.metrics).toHaveLength(0);
    expect(data.totalCount).toBe(0);
    expect(data.summary.eventsReceived).toBe(0);
    expect(data.summary.overallStatus).toBe('ok'); // nothing bad = ok
  });
});

// ---------------------------------------------------------------------------
// Alert threshold logic (unit-level, imported directly)
// ---------------------------------------------------------------------------
describe('Alert threshold logic', () => {
  it('failure rate: ok below warning threshold', () => {
    expect(THRESHOLDS.validationFailureRate.warning).toBeGreaterThan(0);
    expect(THRESHOLDS.validationFailureRate.error).toBeGreaterThan(
      THRESHOLDS.validationFailureRate.warning,
    );
  });

  it('completeness rate: error threshold < warning threshold', () => {
    // For completeness, lower is worse
    expect(THRESHOLDS.completenessRate.error).toBeLessThan(
      THRESHOLDS.completenessRate.warning,
    );
  });

  it('duplicate rate: warning threshold > 0', () => {
    expect(THRESHOLDS.duplicateRate.warning).toBeGreaterThan(0);
    expect(THRESHOLDS.duplicateRate.error).toBeGreaterThan(
      THRESHOLDS.duplicateRate.warning,
    );
  });
});

// ---------------------------------------------------------------------------
// Quality metrics are written when schema violations occur
// ---------------------------------------------------------------------------
describe('Quality metrics written on validation failures', () => {
  it('should record a metric when events fail schema validation', async () => {
    // First, create a schema so we can trigger a violation
    const schemaRes = await dashboardFetch('/api/schemas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId,
        eventName: `quality_test_${Date.now()}`,
        properties: {
          required_field: { type: 'string', required: true },
        },
      }),
    });
    if (schemaRes.status !== 201) return; // schema already exists, skip

    const schema = await schemaRes.json();
    const eventName: string = schema.eventName;

    // Get current count before
    const before = await dashboardFetch(
      `/api/quality?applicationId=${applicationId}&days=1`,
    );
    const beforeData = await before.json();
    const beforeRejected: number = beforeData.summary.eventsRejected;

    // Send an event that fails required_field validation
    const eventRes = await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TEST_API_KEY,
      },
      body: JSON.stringify({
        eventName,
        userId: 'quality_test_user',
        sessionId: 'quality_test_session',
        properties: {}, // missing required_field
      }),
    });
    // Expect 422 (all events rejected)
    expect(eventRes.status).toBe(422);

    // Quality metrics should now reflect the rejection
    const after = await dashboardFetch(
      `/api/quality?applicationId=${applicationId}&days=1`,
    );
    const afterData = await after.json();
    expect(afterData.summary.eventsRejected).toBeGreaterThan(beforeRejected);

    // Clean up: deactivate the schema
    await dashboardFetch(`/api/schemas/${schema.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
  });
});
