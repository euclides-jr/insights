/**
 * API Schema Management Endpoint Tests
 *
 * Tests for GET/POST /api/schemas and GET/PUT/DELETE /api/schemas/:id
 *
 * Requires a running server and seeded database:
 *   bun run dev  (in another terminal)
 *   bun prisma db seed
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sessionFetch as fetch } from "./helpers/session";

const API_BASE_URL = process.env.API_URL || "http://localhost:3000";

let applicationId: string;
// Track schemas created by tests so we can clean up
const createdSchemaIds: string[] = [];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeAll(async () => {
  const res = await fetch(`${API_BASE_URL}/api/applications`);
  expect(res.status).toBe(200);
  const body: { applications: { id: string; name: string }[] } =
    await res.json();
  expect(body.applications.length).toBeGreaterThan(0);
  applicationId = body.applications[0].id;
});

afterAll(async () => {
  // Deactivate (soft-delete) all schemas created by this test run
  await Promise.all(
    createdSchemaIds.map((id) =>
      fetch(`${API_BASE_URL}/api/schemas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
    ),
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function uniqueEventName() {
  return `test_event_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function createSchema(
  overrides: Record<string, unknown> = {},
  eventName = uniqueEventName(),
) {
  const res = await fetch(`${API_BASE_URL}/api/schemas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applicationId,
      eventName,
      properties: {
        amount: { type: "number", required: true },
        currency: { type: "string", required: false },
      },
      ...overrides,
    }),
  });
  const data = await res.json();
  if (res.status === 201 && data.id) createdSchemaIds.push(data.id);
  return { res, data };
}

// ---------------------------------------------------------------------------
// GET /api/schemas
// ---------------------------------------------------------------------------
describe("GET /api/schemas", () => {
  it("should return schemas list with metadata", async () => {
    const res = await fetch(`${API_BASE_URL}/api/schemas`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.totalCount).toBe("number");
    expect(Array.isArray(data.schemas)).toBe(true);
    expect(typeof data.page).toBe("number");
    expect(typeof data.pageSize).toBe("number");
  });

  it("should filter by applicationId", async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/schemas?applicationId=${applicationId}`,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const schema of data.schemas) {
      expect(schema.applicationId).toBe(applicationId);
    }
  });

  it("should filter activeOnly", async () => {
    const res = await fetch(`${API_BASE_URL}/api/schemas?activeOnly=true`);
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const schema of data.schemas) {
      expect(schema.isActive).toBe(true);
    }
  });

  it("should support pagination", async () => {
    const res = await fetch(`${API_BASE_URL}/api/schemas?page=1&pageSize=2`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.schemas.length).toBeLessThanOrEqual(2);
    expect(data.pageSize).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// POST /api/schemas
// ---------------------------------------------------------------------------
describe("POST /api/schemas", () => {
  it("should create a new schema", async () => {
    const { res, data } = await createSchema();
    expect(res.status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.isActive).toBe(true);
    expect(data.version).toBe(1);
    expect(data.applicationId).toBe(applicationId);
  });

  it("should return 400 when applicationId is missing", async () => {
    const res = await fetch(`${API_BASE_URL}/api/schemas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "test_event",
        properties: { amount: { type: "number" } },
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("should return 400 when eventName is missing", async () => {
    const res = await fetch(`${API_BASE_URL}/api/schemas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId,
        properties: { amount: { type: "number" } },
      }),
    });
    expect(res.status).toBe(400);
  });

  it("should return 400 when eventName contains invalid characters", async () => {
    const res = await fetch(`${API_BASE_URL}/api/schemas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId,
        eventName: "invalid-event-name!",
        properties: { amount: { type: "number" } },
      }),
    });
    expect(res.status).toBe(400);
  });

  it("should return 400 when properties is empty", async () => {
    const res = await fetch(`${API_BASE_URL}/api/schemas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId,
        eventName: uniqueEventName(),
        properties: {},
      }),
    });
    expect(res.status).toBe(400);
  });

  it("should return 400 when property type is invalid", async () => {
    const res = await fetch(`${API_BASE_URL}/api/schemas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId,
        eventName: uniqueEventName(),
        properties: { amount: { type: "float" } }, // not a valid type
      }),
    });
    expect(res.status).toBe(400);
  });

  it("should return 404 when applicationId does not exist", async () => {
    const res = await fetch(`${API_BASE_URL}/api/schemas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: "00000000-0000-0000-0000-000000000000",
        eventName: uniqueEventName(),
        properties: { amount: { type: "number" } },
      }),
    });
    expect(res.status).toBe(404);
  });

  it("should return 409 when active schema already exists for event name", async () => {
    const eventName = uniqueEventName();
    const { res: first } = await createSchema({}, eventName);
    expect(first.status).toBe(201);

    // Second attempt for the same eventName
    const { res: second, data } = await createSchema({}, eventName);
    expect(second.status).toBe(409);
    expect(data.error).toMatch(/already exists/i);
    expect(data.existingSchemaId).toBeDefined();
  });

  it("should store properties in schemaDefinition", async () => {
    const eventName = uniqueEventName();
    const { data } = await createSchema(
      {
        properties: {
          price: {
            type: "number",
            required: true,
            description: "Price in USD",
          },
          sku: { type: "string", required: false },
        },
      },
      eventName,
    );
    const def = data.schemaDefinition as {
      properties: Record<
        string,
        { type: string; required?: boolean; description?: string }
      >;
    };
    expect(def.properties.price.type).toBe("number");
    expect(def.properties.price.required).toBe(true);
    expect(def.properties.price.description).toBe("Price in USD");
    expect(def.properties.sku.type).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// GET /api/schemas/:id
// ---------------------------------------------------------------------------
describe("GET /api/schemas/:id", () => {
  it("should return schema with versions", async () => {
    const { data: created } = await createSchema();
    const res = await fetch(`${API_BASE_URL}/api/schemas/${created.id}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(created.id);
    expect(Array.isArray(data.versions)).toBe(true);
    expect(data.versions.length).toBeGreaterThan(0);
  });

  it("should return 404 for non-existent schema", async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/schemas/00000000-0000-0000-0000-000000000000`,
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/schemas/:id — versioning
// ---------------------------------------------------------------------------
describe("PUT /api/schemas/:id", () => {
  it("should create a new version when updating properties", async () => {
    const eventName = uniqueEventName();
    const { data: v1 } = await createSchema({}, eventName);
    expect(v1.version).toBe(1);

    const res = await fetch(`${API_BASE_URL}/api/schemas/${v1.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          amount: { type: "number", required: true },
          currency: { type: "string", required: true }, // now required
          description: { type: "string", required: false },
        },
      }),
    });
    expect(res.status).toBe(201);
    const v2 = await res.json();
    expect(v2.version).toBe(2);
    expect(v2.isActive).toBe(true);
    expect(v2.id).not.toBe(v1.id);
    createdSchemaIds.push(v2.id);

    // Old version should be deactivated
    const oldRes = await fetch(`${API_BASE_URL}/api/schemas/${v1.id}`);
    const old = await oldRes.json();
    expect(old.isActive).toBe(false);
  });

  it("should deactivate without creating new version when isActive: false", async () => {
    const { data: schema } = await createSchema();
    const res = await fetch(`${API_BASE_URL}/api/schemas/${schema.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isActive).toBe(false);
    expect(data.version).toBe(schema.version); // same version
  });

  it("should reactivate an inactive schema", async () => {
    const { data: schema } = await createSchema();
    // Deactivate first
    await fetch(`${API_BASE_URL}/api/schemas/${schema.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    // Re-activate
    const res = await fetch(`${API_BASE_URL}/api/schemas/${schema.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isActive).toBe(true);
  });

  it("should return 422 when updating properties of an inactive schema", async () => {
    const { data: schema } = await createSchema();
    // Deactivate
    await fetch(`${API_BASE_URL}/api/schemas/${schema.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    // Now try to bump version
    const res = await fetch(`${API_BASE_URL}/api/schemas/${schema.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: { amount: { type: "number" } },
      }),
    });
    expect(res.status).toBe(422);
  });

  it("should return 400 when properties are invalid in update", async () => {
    const { data: schema } = await createSchema();
    const res = await fetch(`${API_BASE_URL}/api/schemas/${schema.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {}, // empty not allowed
      }),
    });
    expect(res.status).toBe(400);
  });

  it("should return 404 for non-existent schema", async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/schemas/00000000-0000-0000-0000-000000000000`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      },
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/schemas/:id (soft delete)
// ---------------------------------------------------------------------------
describe("DELETE /api/schemas/:id", () => {
  it("should deactivate the schema and return 204", async () => {
    const { data: schema } = await createSchema();
    const res = await fetch(`${API_BASE_URL}/api/schemas/${schema.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);

    // Verify deactivation
    const check = await fetch(`${API_BASE_URL}/api/schemas/${schema.id}`);
    const data = await check.json();
    expect(data.isActive).toBe(false);
  });

  it("should return 404 for non-existent schema", async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/schemas/00000000-0000-0000-0000-000000000000`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(404);
  });
});
