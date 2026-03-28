/**
 * API AI Endpoint Tests
 *
 * Tests for POST /api/ai/generate and POST /api/ai/explain endpoints
 * Run with: bun test tests/api/ai.test.ts
 *
 * Requires a running server and seeded database:
 *   bun run dev  (in another terminal)
 *   bun prisma db seed
 */

import { describe, it, expect, beforeAll } from "vitest";
import { sessionFetch } from "./helpers/session";

const API_BASE_URL = process.env.API_URL || "http://localhost:3000";
const TEST_API_KEY = process.env.TEST_API_KEY || "demo_app_key_123";

const START_DATE = "2026-03-21T00:00:00.000Z";
const END_DATE = "2026-03-28T23:59:59.000Z";

let applicationId: string;
let noSchemasApplicationId: string;

beforeAll(async () => {
  const res = await sessionFetch(`${API_BASE_URL}/api/applications`);
  expect(res.status).toBe(200);
  const body: { applications: { id: string; name: string; apiKey: string }[] } =
    await res.json();
  const demo = body.applications.find((a) => a.apiKey === TEST_API_KEY);
  expect(demo).toBeDefined();
  applicationId = demo!.id;

  // Always create a fresh app so the no-schema test cannot inherit stale schemas
  // from a previous run.
  const createRes = await sessionFetch(`${API_BASE_URL}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `ai-test-no-schemas-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }),
  });
  expect(createRes.status).toBe(201);
  const created: { application: { id: string } } = await createRes.json();
  noSchemasApplicationId = created.application.id;
});

// ---------------------------------------------------------------------------
// POST /api/ai/generate
// ---------------------------------------------------------------------------

function postGenerate(body: object) {
  return sessionFetch(`${API_BASE_URL}/api/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function postExplain(body: object) {
  return sessionFetch(`${API_BASE_URL}/api/ai/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/generate", () => {
  it("returns 400 when question field is missing", async () => {
    const res = await postGenerate({
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
    });
    expect(res.status).toBe(400);
    const data: { error: string; details?: unknown[] } = await res.json();
    expect(data.error).toBe("validation_error");
    expect(data.details).toBeDefined();
  });

  it("returns 400 when question exceeds 500 characters", async () => {
    const res = await postGenerate({
      question: "a".repeat(501),
      applicationId,
      startDate: START_DATE,
      endDate: END_DATE,
    });
    expect(res.status).toBe(400);
    const data: { error: string } = await res.json();
    expect(data.error).toBe("validation_error");
  });

  it("returns 400 when applicationId is missing", async () => {
    const res = await postGenerate({
      question: "How many signups?",
      startDate: START_DATE,
      endDate: END_DATE,
    });
    expect(res.status).toBe(400);
    const data: { error: string } = await res.json();
    expect(data.error).toBe("validation_error");
  });

  it("returns 400 when startDate is not ISO 8601", async () => {
    const res = await postGenerate({
      question: "How many signups?",
      applicationId,
      startDate: "not-a-date",
      endDate: END_DATE,
    });
    expect(res.status).toBe(400);
    const data: { error: string } = await res.json();
    expect(data.error).toBe("validation_error");
  });

  it("returns 422 no_schemas for an application with no active schemas", async () => {
    const res = await postGenerate({
      question: "How many events?",
      applicationId: noSchemasApplicationId,
      startDate: START_DATE,
      endDate: END_DATE,
    });

    expect(res.status).toBe(422);
    const data: { error: string; message: string } = await res.json();
    expect(data.error).toBe("no_schemas");
    expect(data.message).toBeTruthy();
  });

  it("returns 401 when no session is present", async () => {
    const res = await fetch(`${API_BASE_URL}/api/ai/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "test",
        applicationId,
        startDate: START_DATE,
        endDate: END_DATE,
      }),
    });
    expect([401, 302, 403]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// POST /api/ai/explain
// ---------------------------------------------------------------------------

const MOCK_QUERY_BASE = {
  eventName: "signup",
  startDate: START_DATE,
  endDate: END_DATE,
  aggregation: "count",
};

const mockResults = [
  { group: "pro", value: 142 },
  { group: "free", value: 89 },
];

describe("POST /api/ai/explain", () => {
  it("returns 400 when question field is missing", async () => {
    const res = await postExplain({
      query: { ...MOCK_QUERY_BASE, applicationId },
      results: mockResults,
      totalCount: 2,
    });
    expect(res.status).toBe(400);
    const data: { error: string } = await res.json();
    expect(data.error).toBe("validation_error");
  });

  it("returns 400 when totalCount is negative", async () => {
    const res = await postExplain({
      question: "How many signups?",
      query: { ...MOCK_QUERY_BASE, applicationId },
      results: mockResults,
      totalCount: -1,
    });
    expect(res.status).toBe(400);
    const data: { error: string } = await res.json();
    expect(data.error).toBe("validation_error");
  });

  it("returns 400 when query is missing required fields", async () => {
    const res = await postExplain({
      question: "How many signups?",
      query: { eventName: "signup" },
      results: mockResults,
      totalCount: 2,
    });
    expect(res.status).toBe(400);
    const data: { error: string } = await res.json();
    expect(data.error).toBe("validation_error");
  });

  it("returns 401 when no session is present", async () => {
    const res = await fetch(`${API_BASE_URL}/api/ai/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "test",
        query: { ...MOCK_QUERY_BASE, applicationId },
        results: mockResults,
        totalCount: 2,
      }),
    });
    expect([401, 302, 403]).toContain(res.status);
  });
});
