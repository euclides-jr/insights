import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryRequest {
  applicationId: string;
  eventName?: string;
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  filters?: Record<string, string | number | boolean>;
  aggregation?: 'count' | 'unique_users' | 'avg' | 'sum';
  aggregationField?: string; // JSON property key; required for avg/sum
  groupBy?: string;          // JSON property key to group results by
  limit?: number;            // max 10000, default 1000
}

export interface QueryResult {
  results: Record<string, unknown>[];
  totalCount: number;
  executionTimeMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Allow only alphanumeric + underscore + dot in identifiers used as
 * JSON property keys in raw SQL to prevent injection.
 */
function sanitizePropertyKey(key: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(key)) {
    throw new Error(
      `Invalid property key "${key}". Only letters, numbers, underscores, and dots are allowed.`,
    );
  }
  return key;
}

/**
 * Serialise BigInt values returned by PostgreSQL COUNT / SUM to numbers.
 */
function serialiseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core query execution
// ---------------------------------------------------------------------------

export async function executeQuery(req: QueryRequest): Promise<QueryResult> {
  const startTime = Date.now();

  // --- Build parameterised WHERE clause ---
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  conditions.push(`"applicationId" = $${idx++}`);
  params.push(req.applicationId);

  if (req.eventName) {
    conditions.push(`"eventName" = $${idx++}`);
    params.push(req.eventName);
  }

  conditions.push(`"timestamp" >= $${idx++}`);
  params.push(new Date(req.startDate));

  conditions.push(`"timestamp" <= $${idx++}`);
  params.push(new Date(req.endDate));

  if (req.filters) {
    for (const [key, value] of Object.entries(req.filters)) {
      const safeKey = sanitizePropertyKey(key);
      conditions.push(`properties->>'${safeKey}' = $${idx++}`);
      params.push(String(value));
    }
  }

  const where = conditions.join(' AND ');
  const limit = Math.min(req.limit ?? 1000, 10000);

  let sql: string;

  if (req.groupBy) {
    // ----- Grouped results -----
    const groupKey = sanitizePropertyKey(req.groupBy);

    let selectAgg: string;
    if (req.aggregation === 'unique_users') {
      selectAgg = `COUNT(DISTINCT "userId") AS "value"`;
    } else if (req.aggregation === 'avg' && req.aggregationField) {
      const field = sanitizePropertyKey(req.aggregationField);
      selectAgg = `AVG((properties->>'${field}')::numeric) AS "value"`;
    } else if (req.aggregation === 'sum' && req.aggregationField) {
      const field = sanitizePropertyKey(req.aggregationField);
      selectAgg = `SUM((properties->>'${field}')::numeric) AS "value"`;
    } else {
      selectAgg = `COUNT(*) AS "value"`;
    }

    sql = [
      `SELECT properties->>'${groupKey}' AS "group", ${selectAgg}`,
      `FROM events`,
      `WHERE ${where}`,
      `GROUP BY properties->>'${groupKey}'`,
      `ORDER BY 2 DESC`,
      `LIMIT ${limit}`,
    ].join(' ');
  } else if (req.aggregation === 'avg' && req.aggregationField) {
    // ----- Scalar avg -----
    const field = sanitizePropertyKey(req.aggregationField);
    sql = `SELECT AVG((properties->>'${field}')::numeric) AS "value" FROM events WHERE ${where}`;
  } else if (req.aggregation === 'sum' && req.aggregationField) {
    // ----- Scalar sum -----
    const field = sanitizePropertyKey(req.aggregationField);
    sql = `SELECT SUM((properties->>'${field}')::numeric) AS "value" FROM events WHERE ${where}`;
  } else if (req.aggregation === 'unique_users') {
    // ----- Scalar unique users -----
    sql = `SELECT COUNT(DISTINCT "userId") AS "value" FROM events WHERE ${where}`;
  } else {
    // ----- Default: count -----
    sql = `SELECT COUNT(*) AS "value" FROM events WHERE ${where}`;
  }

  const rows = (await prisma.$queryRawUnsafe(sql, ...params)) as Record<
    string,
    unknown
  >[];

  const results = rows.map(serialiseRow);
  const executionTimeMs = Date.now() - startTime;

  return {
    results,
    totalCount: results.length,
    executionTimeMs,
  };
}
