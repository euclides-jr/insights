/**
 * Unit tests for lib/services/user-attribute-service.ts
 *
 * All Prisma DB calls are mocked — no running database required.
 * Mocking follows the Prisma-recommended singleton pattern using
 * jest-mock-extended's mockDeep helper:
 * https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing
 *
 * The tests exercise:
 *   1. normalizeAndValidateAttributes — reserved keys, format validation,
 *      size limits, lowercase normalisation
 *   2. inferSqlCast — value-type → SQL cast fragment
 *   3. buildAttributeCondition — per-operator SQL fragment generation
 *   4. buildAttributeWhereClause — AND/OR grouping and empty-filter fallback
 *   5. serializeProfile — Date → ISO string serialisation via getUserProfile
 *   6. getAttributeHistory — at/since/until/attributeKey routing
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "jest-mock-extended";

// ─── Mock Prisma before the service is imported ───────────────────────────────
// vi.mock is hoisted by Vitest to the top of this module, so the factory runs
// before any static import is resolved. mockDeep<PrismaClient>() creates a
// fully-typed deep mock — every Prisma model and raw-query method is available
// without manually listing each one as vi.fn().

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import {
  upsertUserProfile,
  getUserProfile,
  listUsers,
  buildCombinedUserQuery,
  getAttributeHistory,
} from "@/lib/services/user-attribute-service";

// prismaMock is the same DeepMockProxy instance the service receives.
import { prismaMock } from "./prisma-singleton";

// ─── Reset all mocks before every test ───────────────────────────────────────
// mockReset(prismaMock) restores the deep Prisma proxy shape, while
// vi.clearAllMocks() drops call history for the non-Prisma mocks used here.

beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
});

// A minimal profile row returned by the upsert SQL
function makeProfileRow(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "row-id-1",
    applicationId: "app-1",
    userId: "user-1",
    attributes: { plan: "pro" } as unknown,
    firstSeen: now,
    lastSeen: now,
    eventCount: 0,
    lastEventName: null as string | null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── 1. normalizeAndValidateAttributes ────────────────────────────────────────

describe("normalizeAndValidateAttributes (via upsertUserProfile)", () => {
  const APP_ID = "app-1";

  it('throws with statusCode 400 for a reserved key "first_seen"', async () => {
    const err = await upsertUserProfile(APP_ID, {
      userId: "u1",
      attributes: { first_seen: "2026-01-01" },
    }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/reserved/i);
    expect(err.statusCode).toBe(400);
  });

  it("throws for every reserved key", async () => {
    const reservedKeys = [
      "last_seen",
      "user_id",
      "event_count",
      "last_event_name",
    ];

    for (const key of reservedKeys) {
      const err = await upsertUserProfile(APP_ID, {
        userId: "u1",
        attributes: { [key]: "x" },
      }).catch((e) => e);

      expect(err.statusCode, `key: ${key}`).toBe(400);
      expect(err.message, `key: ${key}`).toMatch(/reserved/i);
    }
  });

  it("throws with statusCode 400 for a key with invalid format (hyphen)", async () => {
    const err = await upsertUserProfile(APP_ID, {
      userId: "u1",
      attributes: { "bad-key": "value" },
    }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/must match/i);
  });

  it("throws for keys with spaces", async () => {
    const err = await upsertUserProfile(APP_ID, {
      userId: "u1",
      attributes: { "has space": "value" },
    }).catch((e) => e);

    expect(err.statusCode).toBe(400);
  });

  it("throws for keys that start with a digit when after lowercasing they are invalid", async () => {
    // digits are allowed — key "123abc" is valid; key "abc!def" is invalid
    const err = await upsertUserProfile(APP_ID, {
      userId: "u1",
      attributes: { "abc!def": "value" },
    }).catch((e) => e);

    expect(err.statusCode).toBe(400);
  });

  it("throws with statusCode 413 when attribute value exceeds 10 KB", async () => {
    const bigValue = "x".repeat(10 * 1024 + 1);
    const err = await upsertUserProfile(APP_ID, {
      userId: "u1",
      attributes: { plan: bigValue },
    }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(413);
    expect(err.message).toMatch(/exceeds/i);
  });

  it("normalises uppercase attribute keys to lowercase before storage", async () => {
    // Setup mocks: existing-attrs fetch returns nothing, upsert returns a row
    prismaMock.$queryRaw
      .mockResolvedValueOnce([]) // existing attrs SELECT
      .mockResolvedValueOnce([makeProfileRow({ attributes: { plan: "pro" } })]); // upsert RETURNING
    prismaMock.userAttributeHistory.create.mockResolvedValue({} as never);

    await upsertUserProfile(APP_ID, {
      userId: "u1",
      attributes: { PLAN: "pro", Country: "US" },
    });

    // The upsert SQL (second $queryRaw call) should contain the lowercased keys
    const upsertCall = prismaMock.$queryRaw.mock.calls[1];
    // Prisma.sql returns a TemplateStringsArray object; the values are the interpolated args
    // The JSON of the attrs is passed as the second interpolated value
    const sqlValues = upsertCall[0] as { values: unknown[] };
    const attrsJson = sqlValues.values?.find(
      (v) => typeof v === "string" && v.includes("plan"),
    );
    expect(attrsJson).toBeDefined();
    expect(attrsJson).toContain('"plan"');
    expect(attrsJson).toContain('"country"');
    expect(attrsJson).not.toContain("PLAN");
    expect(attrsJson).not.toContain("Country");
  });

  it("accepts valid attribute keys with digits and underscores", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeProfileRow()]);
    prismaMock.userAttributeHistory.create.mockResolvedValue({} as never);

    // Should NOT throw
    await expect(
      upsertUserProfile(APP_ID, {
        userId: "u1",
        attributes: { plan_2: "pro", account_age: 30, is_active_123: true },
      }),
    ).resolves.toBeDefined();
  });

  it("accepts an empty attributes map without throwing", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeProfileRow({ attributes: {} })]);
    prismaMock.userAttributeHistory.create.mockResolvedValue({} as never);

    await expect(
      upsertUserProfile(APP_ID, { userId: "u1", attributes: {} }),
    ).resolves.toBeDefined();
  });

  it("accepts a null attribute value", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeProfileRow({ attributes: { plan: null } })]);
    prismaMock.userAttributeHistory.create.mockResolvedValue({} as never);

    await expect(
      upsertUserProfile(APP_ID, {
        userId: "u1",
        attributes: { plan: null },
      }),
    ).resolves.toBeDefined();
  });
});

// ─── 2. serializeProfile (via getUserProfile) ─────────────────────────────────

describe("serializeProfile (via getUserProfile)", () => {
  const APP_ID = "app-1";

  it("converts firstSeen and lastSeen Dates to ISO strings", async () => {
    const first = new Date("2025-06-01T10:00:00.000Z");
    const last = new Date("2026-03-01T12:30:00.000Z");
    const created = new Date("2025-06-01T10:00:00.000Z");
    const updated = new Date("2026-03-01T12:30:00.000Z");

    prismaMock.userProfile.findUnique.mockResolvedValueOnce({
      id: "row-1",
      applicationId: APP_ID,
      userId: "u1",
      attributes: { plan: "pro" } as never,
      firstSeen: first,
      lastSeen: last,
      eventCount: 42,
      lastEventName: "purchase",
      createdAt: created,
      updatedAt: updated,
    });

    const result = await getUserProfile(APP_ID, "u1");

    expect(result).not.toBeNull();
    expect(result!.firstSeen).toBe(first.toISOString());
    expect(result!.lastSeen).toBe(last.toISOString());
    expect(result!.createdAt).toBe(created.toISOString());
    expect(result!.updatedAt).toBe(updated.toISOString());
  });

  it("passes through null lastEventName", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValueOnce({
      id: "row-1",
      applicationId: APP_ID,
      userId: "u1",
      attributes: {} as never,
      firstSeen: new Date(),
      lastSeen: new Date(),
      eventCount: 0,
      lastEventName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getUserProfile(APP_ID, "u1");
    expect(result!.lastEventName).toBeNull();
  });

  it("passes through attributes as-is", async () => {
    const attrs = { plan: "enterprise", score: 99, is_trial: false };
    prismaMock.userProfile.findUnique.mockResolvedValueOnce({
      id: "row-1",
      applicationId: APP_ID,
      userId: "u1",
      attributes: attrs as never,
      firstSeen: new Date(),
      lastSeen: new Date(),
      eventCount: 5,
      lastEventName: "page_view",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getUserProfile(APP_ID, "u1");
    expect(result!.attributes).toEqual(attrs);
  });

  it("returns null when the user does not exist", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValueOnce(null);
    const result = await getUserProfile(APP_ID, "nobody");
    expect(result).toBeNull();
  });
});

// ─── 3. inferSqlCast + buildAttributeCondition (via listUsers SQL) ────────────

describe("inferSqlCast and buildAttributeCondition (via listUsers SQL)", () => {
  const APP_ID = "app-1";
  const BASE_QUERY = {
    filters: [],
    eventFilters: [],
    page: 1,
    pageSize: 50,
    sortBy: "lastSeen" as const,
    sortOrder: "desc" as const,
  };

  beforeEach(() => {
    // Default: count = 0 rows, data = []
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([]);
  });

  function captureCountSql() {
    // First $queryRawUnsafe call is the COUNT query
    return prismaMock.$queryRawUnsafe.mock.calls[0]?.[0] as string;
  }

  async function runFilter(filter: {
    key: string;
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
    value: unknown;
    logic?: "and" | "or";
  }) {
    await listUsers(APP_ID, {
      ...BASE_QUERY,
      filters: [{ logic: "and", ...filter } as never],
    });
    return captureCountSql();
  }

  // inferSqlCast — numeric
  it("adds ::numeric cast for a number value", async () => {
    const sql = await runFilter({ key: "score", operator: "eq", value: 42 });
    expect(sql).toContain("::numeric");
  });

  // inferSqlCast — boolean
  it("adds ::boolean cast for a boolean value", async () => {
    const sql = await runFilter({
      key: "is_trial",
      operator: "eq",
      value: true,
    });
    expect(sql).toContain("::boolean");
  });

  // inferSqlCast — ISO date string
  it("adds ::timestamptz cast for an ISO date string", async () => {
    const sql = await runFilter({
      key: "signed_up_at",
      operator: "gt",
      value: "2026-01-01",
    });
    expect(sql).toContain("::timestamptz");
  });

  // inferSqlCast — plain string
  it("uses no cast for a plain string value", async () => {
    const sql = await runFilter({ key: "plan", operator: "eq", value: "pro" });
    expect(sql).not.toContain("::numeric");
    expect(sql).not.toContain("::boolean");
    expect(sql).not.toContain("::timestamptz");
  });

  // buildAttributeCondition — operators
  it("generates = for eq operator", async () => {
    const sql = await runFilter({ key: "plan", operator: "eq", value: "pro" });
    expect(sql).toMatch(/=\s*\$\d+/);
  });

  it("generates != for neq operator", async () => {
    const sql = await runFilter({
      key: "plan",
      operator: "neq",
      value: "free",
    });
    expect(sql).toContain("!=");
  });

  it("generates > for gt operator", async () => {
    const sql = await runFilter({
      key: "score",
      operator: "gt",
      value: 50,
    });
    expect(sql).toContain(">");
  });

  it("generates >= for gte operator", async () => {
    const sql = await runFilter({
      key: "score",
      operator: "gte",
      value: 50,
    });
    expect(sql).toContain(">=");
  });

  it("generates < for lt operator", async () => {
    const sql = await runFilter({
      key: "score",
      operator: "lt",
      value: 50,
    });
    expect(sql).toContain("<");
  });

  it("generates <= for lte operator", async () => {
    const sql = await runFilter({
      key: "score",
      operator: "lte",
      value: 50,
    });
    expect(sql).toContain("<=");
  });

  it("generates ILIKE with wildcard wrapping for contains operator", async () => {
    const sql = await runFilter({
      key: "company",
      operator: "contains",
      value: "acme",
    });
    expect(sql).toMatch(/ILIKE/i);
    expect(sql).toContain("'%'");
  });

  // Key name is embedded in the SQL extraction expression
  it("embeds the attribute key name in the JSONB extraction expression", async () => {
    const sql = await runFilter({
      key: "my_custom_key",
      operator: "eq",
      value: "x",
    });
    expect(sql).toContain("->>'my_custom_key'");
  });
});

// ─── 4. buildAttributeWhereClause (via listUsers SQL) ─────────────────────────

describe("buildAttributeWhereClause (via listUsers SQL)", () => {
  const APP_ID = "app-2";
  const BASE_QUERY = {
    eventFilters: [],
    page: 1,
    pageSize: 50,
    sortBy: "lastSeen" as const,
    sortOrder: "desc" as const,
  };

  beforeEach(() => {
    // listUsers makes two $queryRawUnsafe calls: COUNT then data rows.
    // Use mockResolvedValueOnce for each so the data-rows call returns []
    // instead of the count shape (which would crash serializeProfile).
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ count: BigInt(0) }]) // COUNT query
      .mockResolvedValueOnce([]); // data rows query
  });

  function countSql() {
    return prismaMock.$queryRawUnsafe.mock.calls[0]?.[0] as string;
  }

  it('falls back to "1=1" when filters array is empty', async () => {
    await listUsers(APP_ID, { ...BASE_QUERY, filters: [] });
    expect(countSql()).toContain("1=1");
  });

  it("wraps a single AND filter in parentheses", async () => {
    await listUsers(APP_ID, {
      ...BASE_QUERY,
      filters: [{ key: "plan", operator: "eq", value: "pro", logic: "and" }],
    });
    const sql = countSql();
    // AND group: ((condition))
    expect(sql).toMatch(/\(\(up\.attributes/);
  });

  it("joins multiple AND filters with AND inside one group", async () => {
    await listUsers(APP_ID, {
      ...BASE_QUERY,
      filters: [
        { key: "plan", operator: "eq", value: "pro", logic: "and" },
        { key: "country", operator: "eq", value: "US", logic: "and" },
      ],
    });
    const sql = countSql();
    expect(sql).toContain(" AND ");
    // Both keys present
    expect(sql).toContain("'plan'");
    expect(sql).toContain("'country'");
  });

  it("puts OR-logic filters into their own OR group", async () => {
    await listUsers(APP_ID, {
      ...BASE_QUERY,
      filters: [
        { key: "plan", operator: "eq", value: "pro", logic: "or" },
        { key: "plan", operator: "eq", value: "enterprise", logic: "or" },
      ],
    });
    const sql = countSql();
    // OR group: (condition OR condition)
    expect(sql).toContain(" OR ");
  });

  it('emits "(andGroup) OR (orGroup)" for mixed AND + OR filters', async () => {
    await listUsers(APP_ID, {
      ...BASE_QUERY,
      filters: [
        { key: "plan", operator: "eq", value: "pro", logic: "and" },
        { key: "plan", operator: "eq", value: "enterprise", logic: "or" },
      ],
    });
    const sql = countSql();
    // Must contain both AND and OR at the group level
    expect(sql).toContain(" AND ");
    expect(sql).toContain(" OR ");
  });

  it("uses sequential parameter placeholders ($2, $3, …) for each filter", async () => {
    await listUsers(APP_ID, {
      ...BASE_QUERY,
      filters: [
        { key: "plan", operator: "eq", value: "pro", logic: "and" },
        { key: "country", operator: "eq", value: "US", logic: "and" },
      ],
    });
    const sql = countSql();
    // $1 = applicationId; filter params start at $2
    expect(sql).toContain("$2");
    expect(sql).toContain("$3");
  });

  it("passes the correct parameter values to $queryRawUnsafe", async () => {
    await listUsers(APP_ID, {
      ...BASE_QUERY,
      filters: [
        { key: "plan", operator: "eq", value: "pro", logic: "and" },
        { key: "score", operator: "gt", value: 10, logic: "and" },
      ],
    });
    const callArgs = prismaMock.$queryRawUnsafe.mock.calls[0];
    // args: [sql, applicationId, 'pro', 10, ... limit/offset for count]
    // Count query args: [sql, APP_ID, 'pro', 10]
    expect(callArgs[1]).toBe(APP_ID);
    expect(callArgs).toContain("pro");
    expect(callArgs).toContain(10);
  });
});

// ─── 5. getAttributeHistory routing ──────────────────────────────────────────

describe("getAttributeHistory", () => {
  const APP_ID = "app-3";
  const USER_ID = "user-hist";

  it("uses $queryRaw (point-in-time) when `at` is provided", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await getAttributeHistory(APP_ID, USER_ID, {
      at: new Date("2026-02-01T00:00:00Z"),
    });

    expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
    expect(prismaMock.userAttributeHistory.findMany).not.toHaveBeenCalled();
  });

  it("uses userAttributeHistory.findMany when `at` is absent", async () => {
    prismaMock.userAttributeHistory.findMany.mockResolvedValueOnce([]);

    await getAttributeHistory(APP_ID, USER_ID, {});

    expect(prismaMock.userAttributeHistory.findMany).toHaveBeenCalledOnce();
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("passes attributeKey filter to findMany when provided", async () => {
    prismaMock.userAttributeHistory.findMany.mockResolvedValueOnce([]);

    await getAttributeHistory(APP_ID, USER_ID, { attributeKey: "plan" });

    const whereArg =
      prismaMock.userAttributeHistory.findMany.mock.calls[0][0]?.where;
    expect(whereArg).toMatchObject({ attributeKey: "plan" });
  });

  it("passes since/until range to findMany", async () => {
    prismaMock.userAttributeHistory.findMany.mockResolvedValueOnce([]);
    const since = new Date("2026-01-01");
    const until = new Date("2026-03-01");

    await getAttributeHistory(APP_ID, USER_ID, { since, until });

    const whereArg =
      prismaMock.userAttributeHistory.findMany.mock.calls[0][0]?.where;
    expect(whereArg?.changedAt).toMatchObject({ gte: since, lte: until });
  });

  it("passes only `since` when `until` is absent", async () => {
    prismaMock.userAttributeHistory.findMany.mockResolvedValueOnce([]);
    const since = new Date("2026-01-01");

    await getAttributeHistory(APP_ID, USER_ID, { since });

    const whereArg =
      prismaMock.userAttributeHistory.findMany.mock.calls[0][0]?.where;
    expect(whereArg?.changedAt).toMatchObject({ gte: since });
    expect(whereArg?.changedAt?.lte).toBeUndefined();
  });

  it("returns history rows with ISO changedAt strings", async () => {
    const changedAt = new Date("2026-02-15T08:00:00.000Z");
    prismaMock.userAttributeHistory.findMany.mockResolvedValueOnce([
      {
        id: "h1",
        applicationId: APP_ID,
        userId: USER_ID,
        attributeKey: "plan",
        oldValue: "free",
        newValue: "pro",
        changedAt,
      },
    ] as never);

    const result = await getAttributeHistory(APP_ID, USER_ID, {});

    expect(result.history).toHaveLength(1);
    expect(result.history[0].changedAt).toBe(changedAt.toISOString());
    expect(result.totalCount).toBe(1);
  });

  it("returns empty history when no rows match", async () => {
    prismaMock.userAttributeHistory.findMany.mockResolvedValueOnce([]);

    const result = await getAttributeHistory(APP_ID, USER_ID, {});
    expect(result.history).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it("includes userId and applicationId in the response envelope", async () => {
    prismaMock.userAttributeHistory.findMany.mockResolvedValueOnce([]);

    const result = await getAttributeHistory(APP_ID, USER_ID, {});
    expect(result.userId).toBe(USER_ID);
    expect(result.applicationId).toBe(APP_ID);
  });
});

// ─── 6. FR-019 historical attribute correlation ─────────────────────────────

describe("buildCombinedUserQuery (FR-019 historical attribute correlation)", () => {
  const APP_ID = "app-historical";

  beforeEach(() => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([]);
  });

  it("evaluates attribute filters against attribute history at event timestamp", async () => {
    await buildCombinedUserQuery(APP_ID, {
      filters: [{ key: "plan", operator: "eq", value: "pro", logic: "and" }],
      eventFilters: [{ eventName: "checkout_clicked", operator: "performed" }],
      page: 1,
      pageSize: 50,
      sortBy: "lastSeen",
      sortOrder: "desc",
    });

    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0] as string;
    expect(sql).toContain("LEFT JOIN LATERAL");
    expect(sql).toContain('"changedAt" <= e.timestamp');
    expect(sql).toContain("COALESCE(_hist.attrs, '{}'::jsonb)");
    expect(sql).toContain("->>'plan'");
  });

  it("falls back to listUsers behavior when no event filters are present", async () => {
    prismaMock.$queryRawUnsafe.mockReset();
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ count: BigInt(0) }])
      .mockResolvedValueOnce([]);

    await buildCombinedUserQuery(APP_ID, {
      filters: [{ key: "plan", operator: "eq", value: "pro", logic: "and" }],
      eventFilters: [],
      page: 1,
      pageSize: 50,
      sortBy: "lastSeen",
      sortOrder: "desc",
    });

    const sql = prismaMock.$queryRawUnsafe.mock.calls[0]?.[0] as string;
    expect(sql).not.toContain("LEFT JOIN LATERAL");
    expect(sql).toContain("FROM user_profiles up");
    expect(sql).toContain("->>'plan'");
  });
});
