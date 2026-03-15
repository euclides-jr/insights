import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import type {
  AttributeFilter,
  CombinedQuery,
  IdentifyRequest,
} from '@/lib/validations/user-schemas';
import {
  RESERVED_KEYS,
  ATTRIBUTE_KEY_REGEX,
  ATTRIBUTE_VALUE_MAX_BYTES,
} from '@/lib/validations/user-schemas';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfileResponse {
  userId: string;
  applicationId: string;
  attributes: Record<string, string | number | boolean | null>;
  firstSeen: string;
  lastSeen: string;
  eventCount: number;
  lastEventName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  users: UserProfileResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  executionTimeMs: number;
}

export interface AttributeHistoryEntry {
  id: string;
  attributeKey: string;
  oldValue: unknown;
  newValue: unknown;
  changedAt: string;
}

export interface AttributeHistoryResponse {
  userId: string;
  applicationId: string;
  history: AttributeHistoryEntry[];
  totalCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Serialise a Prisma UserProfile row into the API response shape */
function serializeProfile(row: {
  userId: string;
  applicationId: string;
  attributes: unknown;
  firstSeen: Date;
  lastSeen: Date;
  eventCount: number;
  lastEventName: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserProfileResponse {
  return {
    userId: row.userId,
    applicationId: row.applicationId,
    attributes: (row.attributes ?? {}) as Record<
      string,
      string | number | boolean | null
    >,
    firstSeen: row.firstSeen.toISOString(),
    lastSeen: row.lastSeen.toISOString(),
    eventCount: row.eventCount,
    lastEventName: row.lastEventName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Validate incoming attribute map and throw a structured error if invalid.
 * Returns a normalised map (keys lowercased for storage).
 */
function normalizeAndValidateAttributes(
  attrs: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};

  for (const [rawKey, value] of Object.entries(attrs)) {
    const key = rawKey.toLowerCase();

    if (RESERVED_KEYS.has(key)) {
      throw Object.assign(
        new Error(`"${rawKey}" is a reserved system attribute`),
        {
          statusCode: 400,
          field: rawKey,
        },
      );
    }

    if (!ATTRIBUTE_KEY_REGEX.test(key)) {
      throw Object.assign(
        new Error(`Attribute key "${rawKey}" must match /^[a-z0-9_]{1,128}$/`),
        { statusCode: 400, field: rawKey },
      );
    }

    const serialized = JSON.stringify(value);
    if (serialized && serialized.length > ATTRIBUTE_VALUE_MAX_BYTES) {
      throw Object.assign(
        new Error(`Attribute value for "${rawKey}" exceeds 10 KB limit`),
        {
          statusCode: 413,
          field: rawKey,
        },
      );
    }

    result[key] = value as string | number | boolean | null;
  }

  return result;
}

/**
 * Ensure the GIN index on user_profiles.attributes exists.
 * Called once during index-sensitive operations (idempotent, IF NOT EXISTS).
 */
export async function ensureGinIndex(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "user_profiles_attributes_gin_idx"
    ON "user_profiles" USING gin ("attributes" jsonb_path_ops)
  `);
}

// ─── US1: Set User Attributes ─────────────────────────────────────────────────

/**
 * Upsert a user profile, merge new attributes (last-write-wins per key),
 * and record a history entry for every changed key.
 *
 * Implements FR-001, FR-002, FR-004, FR-008, FR-009, FR-013, FR-014.
 */
export async function upsertUserProfile(
  applicationId: string,
  input: IdentifyRequest,
): Promise<UserProfileResponse> {
  const { userId } = input;
  const incomingAttrs = input.attributes
    ? normalizeAndValidateAttributes(input.attributes)
    : {};

  const now = new Date();
  const newId = crypto.randomUUID();

  // Step 1: Read current attrs for history diff (best-effort; may be stale
  // under concurrent writes, but history is per-key so no data is lost).
  const existingRows = await prisma.$queryRaw<{ attributes: unknown }[]>(
    Prisma.sql`
      SELECT attributes
      FROM user_profiles
      WHERE "applicationId" = ${applicationId}
        AND "userId" = ${userId}
    `,
  );
  const currentAttrs = (existingRows[0]?.attributes ?? {}) as Record<
    string,
    unknown
  >;

  // Step 2: Atomic JSONB upsert using the || operator in ON CONFLICT DO UPDATE.
  // This prevents lost-update races under concurrent writes (SC-008):
  //   existing {attr_0: v0} || incoming {attr_1: v1}  →  {attr_0: v0, attr_1: v1}
  const rows = await prisma.$queryRaw<
    {
      id: string;
      applicationId: string;
      userId: string;
      attributes: unknown;
      firstSeen: Date;
      lastSeen: Date;
      eventCount: number;
      lastEventName: string | null;
      createdAt: Date;
      updatedAt: Date;
    }[]
  >(Prisma.sql`
    INSERT INTO user_profiles
      (id, "applicationId", "userId", attributes, "firstSeen", "lastSeen",
       "createdAt", "updatedAt")
    VALUES
      (${newId}, ${applicationId}, ${userId},
       ${JSON.stringify(incomingAttrs)}::jsonb,
       ${now}, ${now}, ${now}, ${now})
    ON CONFLICT ("applicationId", "userId") DO UPDATE SET
      attributes  = user_profiles.attributes || EXCLUDED.attributes,
      "lastSeen"  = GREATEST(user_profiles."lastSeen", EXCLUDED."lastSeen"),
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING
      id, "applicationId", "userId", attributes,
      "firstSeen", "lastSeen", "eventCount", "lastEventName",
      "createdAt", "updatedAt"
  `);

  const row = rows[0];
  if (!row) throw new Error('Upsert returned no rows');

  // Step 3: Compute per-key history diff (only keys THIS call touches)
  const changedKeys = Object.keys(incomingAttrs).filter((k) => {
    const oldSerialized = JSON.stringify(currentAttrs[k] ?? null);
    const newSerialized = JSON.stringify(incomingAttrs[k] ?? null);
    return oldSerialized !== newSerialized;
  });

  if (changedKeys.length > 0) {
    await Promise.all(
      changedKeys.map((key) =>
        prisma.userAttributeHistory.create({
          data: {
            applicationId,
            userId,
            attributeKey: key,
            oldValue:
              currentAttrs[key] !== undefined
                ? currentAttrs[key] === null
                  ? Prisma.JsonNull
                  : (currentAttrs[key] as Prisma.InputJsonValue)
                : Prisma.DbNull,
            newValue:
              incomingAttrs[key] === null
                ? Prisma.JsonNull
                : (incomingAttrs[key] as Prisma.InputJsonValue),
            changedAt: now,
          },
        }),
      ),
    );
  }

  return serializeProfile({
    userId: row.userId,
    applicationId: row.applicationId,
    attributes: row.attributes,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    eventCount: row.eventCount,
    lastEventName: row.lastEventName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Retrieve a single user profile by userId.
 * Returns null when the user does not exist.
 */
export async function getUserProfile(
  applicationId: string,
  userId: string,
): Promise<UserProfileResponse | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { applicationId_userId: { applicationId, userId } },
  });

  if (!profile) return null;
  return serializeProfile(profile);
}

// ─── US2: Query Users by Attributes ──────────────────────────────────────────

/**
 * Build a SQL type cast fragment based on the JS runtime type of a filter
 * value. Falls back to text extraction if the type cannot be inferred.
 */
function inferSqlCast(value: unknown): string {
  if (typeof value === 'number') return '::numeric';
  if (typeof value === 'boolean') return '::boolean';
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(value)
  ) {
    return '::timestamptz';
  }
  return ''; // text comparison (default JSONB ->> extraction returns text)
}

/**
 * Build a parameterized WHERE fragment from a single attribute filter.
 * Returns { sql, params } to be merged into the main query builder.
 */
function buildAttributeCondition(
  filter: AttributeFilter,
  paramOffset: number,
): { sql: string; params: unknown[] } {
  const cast = inferSqlCast(filter.value);
  const jsonExtract = `(up.attributes->>'${filter.key}')${cast}`;
  const placeholder = `$${paramOffset + 1}`;

  let sql: string;
  switch (filter.operator) {
    case 'eq':
      sql = `${jsonExtract} = ${placeholder}${cast}`;
      break;
    case 'neq':
      sql = `${jsonExtract} != ${placeholder}${cast}`;
      break;
    case 'gt':
      sql = `${jsonExtract} > ${placeholder}${cast}`;
      break;
    case 'gte':
      sql = `${jsonExtract} >= ${placeholder}${cast}`;
      break;
    case 'lt':
      sql = `${jsonExtract} < ${placeholder}${cast}`;
      break;
    case 'lte':
      sql = `${jsonExtract} <= ${placeholder}${cast}`;
      break;
    case 'contains':
      sql = `${jsonExtract} ILIKE '%' || ${placeholder} || '%'`;
      break;
    default:
      sql = `${jsonExtract} = ${placeholder}${cast}`;
  }

  return { sql, params: [filter.value] };
}

/**
 * Build a SQL WHERE string from an array of attribute filters, respecting
 * AND/OR logic grouping per filter (FR-006).
 *
 * Filters with `logic: "or"` form an OR group; all others are AND-joined.
 * Emits parenthesized groups: `(andGroup) OR (orGroup)`.
 */
function buildAttributeWhereClause(
  filters: AttributeFilter[],
  baseParamIndex: number,
): { sql: string; params: unknown[] } {
  if (filters.length === 0) return { sql: '1=1', params: [] };

  const andConditions: string[] = [];
  const orConditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = baseParamIndex;

  for (const filter of filters) {
    const { sql, params: p } = buildAttributeCondition(filter, paramIndex);
    paramIndex += p.length;
    params.push(...p);

    if (filter.logic === 'or') {
      orConditions.push(sql);
    } else {
      andConditions.push(sql);
    }
  }

  const parts: string[] = [];
  if (andConditions.length > 0) parts.push(`(${andConditions.join(' AND ')})`);
  if (orConditions.length > 0) parts.push(`(${orConditions.join(' OR ')})`);

  return { sql: parts.join(' OR '), params };
}

/**
 * List users matching attribute filter conditions with pagination (FR-005,
 * FR-006, FR-011, FR-012).
 */
export async function listUsers(
  applicationId: string,
  query: CombinedQuery,
): Promise<UserListResponse> {
  const start = Date.now();
  const {
    filters = [],
    sortBy = 'lastSeen',
    sortOrder = 'desc',
    page,
    pageSize,
  } = query;

  const orderColumn =
    sortBy === 'userId'
      ? 'up."userId"'
      : sortBy === 'firstSeen'
        ? 'up."firstSeen"'
        : sortBy === 'eventCount'
          ? 'up."eventCount"'
          : 'up."lastSeen"';

  // $1 is applicationId, so filter params start at offset 1
  const { sql: whereClause, params } = buildAttributeWhereClause(filters, 1);

  const offset = (page - 1) * pageSize;

  // Count query ($1 = applicationId, $2..$(1+filters.length) = filter values)
  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) AS count
     FROM user_profiles up
     WHERE up."applicationId" = $1
       AND ${whereClause}`,
    applicationId,
    ...params,
  );

  const totalCount = Number(countResult[0]?.count ?? 0);

  // Data query: LIMIT = $${2+params.length}, OFFSET = $${3+params.length}
  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      userId: string;
      applicationId: string;
      attributes: unknown;
      firstSeen: Date;
      lastSeen: Date;
      eventCount: number;
      lastEventName: string | null;
      createdAt: Date;
      updatedAt: Date;
    }[]
  >(
    `SELECT up.id, up."userId", up."applicationId", up.attributes,
            up."firstSeen", up."lastSeen", up."eventCount", up."lastEventName",
            up."createdAt", up."updatedAt"
     FROM user_profiles up
     WHERE up."applicationId" = $1
       AND ${whereClause}
     ORDER BY ${orderColumn} ${sortOrder.toUpperCase()}
     LIMIT $${params.length + 2} OFFSET $${params.length + 3}`,
    applicationId,
    ...params,
    pageSize,
    offset,
  );

  return {
    users: rows.map(serializeProfile),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
    executionTimeMs: Date.now() - start,
  };
}

// ─── US3: Combined attribute + event queries ──────────────────────────────────

/**
 * Reconstruct the user's attribute state at a given point in time by scanning
 * UserAttributeHistory for the last value of each key with changedAt ≤ at.
 * Satisfies FR-019 (correlate events with historically-active attributes).
 */
export async function getAttributesAt(
  applicationId: string,
  userId: string,
  at: Date,
): Promise<Record<string, unknown>> {
  // Most-recent history row per key, where changedAt ≤ at
  const rows = await prisma.$queryRaw<
    { attributeKey: string; newValue: unknown }[]
  >(Prisma.sql`
    SELECT DISTINCT ON ("attributeKey")
      "attributeKey",
      "newValue"
    FROM user_attribute_history
    WHERE "applicationId" = ${applicationId}
      AND "userId"        = ${userId}
      AND "changedAt"    <= ${at}
    ORDER BY "attributeKey", "changedAt" DESC
  `);

  return Object.fromEntries(
    rows
      .filter((r) => r.newValue !== null)
      .map((r) => [r.attributeKey, r.newValue]),
  );
}

/**
 * Build a CTE-based combined query joining user profile attributes with event
 * behavior conditions (FR-007, FR-016, FR-017, FR-018, FR-019).
 *
 * Structure:
 *   WITH _users AS (
 *     SELECT user_id FROM user_profiles WHERE applicationId = $1 AND <attrWhere>
 *   )
 *   SELECT up.* FROM user_profiles up
 *   JOIN _users u ON u.user_id = up."userId"
 *   WHERE <eventBehaviorConditions>
 */
export async function buildCombinedUserQuery(
  applicationId: string,
  query: CombinedQuery,
): Promise<UserListResponse> {
  const start = Date.now();
  const {
    filters = [],
    eventFilters = [],
    sortBy = 'lastSeen',
    sortOrder = 'desc',
    page,
    pageSize,
  } = query;

  const params: unknown[] = [applicationId];
  let paramIdx = 1; // $1 = applicationId

  // ── Attribute WHERE clause ─────────────────────────────────────────────────
  const { sql: attrWhere, params: attrParams } = buildAttributeWhereClause(
    filters,
    paramIdx,
  );
  params.push(...attrParams);
  paramIdx += attrParams.length;

  // ── Event behavior subclauses ──────────────────────────────────────────────
  const eventClauses: string[] = [];

  for (const ef of eventFilters) {
    params.push(ef.eventName);
    const evtNameParam = `$${++paramIdx}`;

    // Time window
    let timeConstraint = '';
    if (ef.timeWindow) {
      params.push(ef.timeWindow.value);
      const valParam = `$${++paramIdx}`;
      const unit = ef.timeWindow.unit === 'days' ? 'days' : 'hours';
      timeConstraint = `AND e.timestamp >= NOW() - INTERVAL '1 ${unit}' * ${valParam}::int`;
    }

    // Event property containment
    let propConstraint = '';
    if (ef.properties && Object.keys(ef.properties).length > 0) {
      params.push(JSON.stringify(ef.properties));
      propConstraint = `AND e.properties @> $${++paramIdx}::jsonb`;
    }

    // Frequency (count min/max → HAVING)
    let havingClause = '';
    if (ef.count?.min !== undefined || ef.count?.max !== undefined) {
      const havingParts: string[] = [];
      if (ef.count.min !== undefined) {
        params.push(ef.count.min);
        havingParts.push(`COUNT(e.id) >= $${++paramIdx}`);
      }
      if (ef.count.max !== undefined) {
        params.push(ef.count.max);
        havingParts.push(`COUNT(e.id) <= $${++paramIdx}`);
      }
      havingClause = `HAVING ${havingParts.join(' AND ')}`;
    }

    const subquery = havingClause
      ? // Aggregate subquery for count conditions
        `EXISTS (
           SELECT 1 FROM (
             SELECT e."userId"
             FROM events e
             WHERE e."applicationId" = $1
               AND e."eventName" = ${evtNameParam}
               AND e."userId" = up."userId"
               ${timeConstraint}
               ${propConstraint}
             GROUP BY e."userId"
             ${havingClause}
           ) _freq
         )`
      : // Simple EXISTS / NOT EXISTS
        `EXISTS (
           SELECT 1 FROM events e
           WHERE e."applicationId" = $1
             AND e."eventName" = ${evtNameParam}
             AND e."userId" = up."userId"
             ${timeConstraint}
             ${propConstraint}
         )`;

    if (ef.operator === 'not_performed') {
      eventClauses.push(`NOT ${subquery}`);
    } else {
      eventClauses.push(subquery);
    }
  }

  const eventWhere =
    eventClauses.length > 0 ? eventClauses.join(' AND ') : '1=1';

  const orderColumn =
    sortBy === 'userId'
      ? 'up."userId"'
      : sortBy === 'firstSeen'
        ? 'up."firstSeen"'
        : sortBy === 'eventCount'
          ? 'up."eventCount"'
          : 'up."lastSeen"';

  const offset = (page - 1) * pageSize;

  // Count
  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `WITH _users AS (
       SELECT up."userId"
       FROM user_profiles up
       WHERE up."applicationId" = $1
         AND ${attrWhere}
     )
     SELECT COUNT(*) AS count
     FROM user_profiles up
     JOIN _users u ON u."userId" = up."userId"
     WHERE ${eventWhere}`,
    ...params,
  );

  const totalCount = Number(countResult[0]?.count ?? 0);

  params.push(pageSize);
  const limitParam = `$${++paramIdx}`;
  params.push(offset);
  const offsetParam = `$${++paramIdx}`;

  // Data rows
  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      userId: string;
      applicationId: string;
      attributes: unknown;
      firstSeen: Date;
      lastSeen: Date;
      eventCount: number;
      lastEventName: string | null;
      createdAt: Date;
      updatedAt: Date;
    }[]
  >(
    `WITH _users AS (
       SELECT up."userId"
       FROM user_profiles up
       WHERE up."applicationId" = $1
         AND ${attrWhere}
     )
     SELECT up.id, up."userId", up."applicationId", up.attributes,
            up."firstSeen", up."lastSeen", up."eventCount", up."lastEventName",
            up."createdAt", up."updatedAt"
     FROM user_profiles up
     JOIN _users u ON u."userId" = up."userId"
     WHERE ${eventWhere}
     ORDER BY ${orderColumn} ${sortOrder.toUpperCase()}
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    ...params,
  );

  return {
    users: rows.map(serializeProfile),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
    executionTimeMs: Date.now() - start,
  };
}

// ─── US4: Attribute History ───────────────────────────────────────────────────

/**
 * Retrieve attribute change history for a user, with optional filters.
 *
 * When `at` is provided, returns the point-in-time state (most-recent value
 * per key with changedAt ≤ at), satisfying US4 Acceptance Scenario 2.
 */
export async function getAttributeHistory(
  applicationId: string,
  userId: string,
  opts: {
    attributeKey?: string;
    since?: Date;
    until?: Date;
    /** Point-in-time snapshot: return latest value per key at this moment */
    at?: Date;
  } = {},
): Promise<AttributeHistoryResponse> {
  const { attributeKey, since, until, at } = opts;

  if (at) {
    // Point-in-time: most-recent value per key where changedAt ≤ at
    const rows = await prisma.$queryRaw<
      {
        id: string;
        attributeKey: string;
        oldValue: unknown;
        newValue: unknown;
        changedAt: Date;
      }[]
    >(
      attributeKey
        ? Prisma.sql`
            SELECT DISTINCT ON ("attributeKey")
              id, "attributeKey", "oldValue", "newValue", "changedAt"
            FROM user_attribute_history
            WHERE "applicationId" = ${applicationId}
              AND "userId"        = ${userId}
              AND "changedAt"    <= ${at}
              AND "attributeKey"  = ${attributeKey}
            ORDER BY "attributeKey", "changedAt" DESC
          `
        : Prisma.sql`
            SELECT DISTINCT ON ("attributeKey")
              id, "attributeKey", "oldValue", "newValue", "changedAt"
            FROM user_attribute_history
            WHERE "applicationId" = ${applicationId}
              AND "userId"        = ${userId}
              AND "changedAt"    <= ${at}
            ORDER BY "attributeKey", "changedAt" DESC
          `,
    );

    const history = rows.map((r) => ({
      id: r.id,
      attributeKey: r.attributeKey,
      oldValue: r.oldValue,
      newValue: r.newValue,
      changedAt: (r.changedAt as Date).toISOString(),
    }));

    return { userId, applicationId, history, totalCount: history.length };
  }

  // Range query
  const rows = await prisma.userAttributeHistory.findMany({
    where: {
      applicationId,
      userId,
      ...(attributeKey ? { attributeKey } : {}),
      ...(since || until
        ? {
            changedAt: {
              ...(since ? { gte: since } : {}),
              ...(until ? { lte: until } : {}),
            },
          }
        : {}),
    },
    orderBy: { changedAt: 'desc' },
  });

  const history = rows.map((r) => ({
    id: r.id,
    attributeKey: r.attributeKey,
    oldValue: r.oldValue,
    newValue: r.newValue,
    changedAt: r.changedAt.toISOString(),
  }));

  return { userId, applicationId, history, totalCount: history.length };
}
