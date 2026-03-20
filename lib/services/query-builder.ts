import { prisma } from '@/lib/db/prisma';
import type {
  PropertyFilter,
  QueryDefinition,
} from '@/lib/validations/query-schemas';

export type QueryRequest = QueryDefinition;

export interface QueryResult {
  results: Record<string, unknown>[];
  totalCount: number;
  executionTimeMs: number;
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

function sanitizePropertyKey(key: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(key)) {
    throw new Error(
      `Invalid property key "${key}". Only letters, numbers, underscores, and dots are allowed.`,
    );
  }
  return key;
}

function serialiseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'bigint') {
      out[k] = Number(v);
      continue;
    }

    if (v instanceof Date) {
      out[k] = v.toISOString();
      continue;
    }

    out[k] = v;
  }
  return out;
}

function buildAggregationSql(req: QueryRequest) {
  if (req.aggregation === 'unique_users') {
    return `COUNT(DISTINCT "userId") AS "value"`;
  }

  if (req.aggregation === 'avg' && req.aggregationField) {
    const field = sanitizePropertyKey(req.aggregationField);
    return `AVG((properties->>'${field}')::numeric) AS "value"`;
  }

  if (req.aggregation === 'sum' && req.aggregationField) {
    const field = sanitizePropertyKey(req.aggregationField);
    return `SUM((properties->>'${field}')::numeric) AS "value"`;
  }

  return `COUNT(*) AS "value"`;
}

function buildPropertyFilterSql(
  filter: PropertyFilter,
  params: unknown[],
  startIndex: number,
) {
  const key = sanitizePropertyKey(filter.key);
  const jsonAccessor = `properties->'${key}'`;
  const textAccessor = `properties->>'${key}'`;
  let idx = startIndex;

  const pushParam = (value: unknown) => {
    params.push(value);
    idx += 1;
    return `$${idx}`;
  };

  let expression: string;

  if (filter.valueType === 'string') {
    switch (filter.operator) {
      case 'eq':
        expression = `${textAccessor} = ${pushParam(filter.value)}`;
        break;
      case 'neq':
        expression = `${textAccessor} <> ${pushParam(filter.value)}`;
        break;
      case 'contains':
        expression = `${textAccessor} ILIKE ${pushParam(`%${String(filter.value)}%`)}`;
        break;
      case 'not_contains':
        expression = `${textAccessor} NOT ILIKE ${pushParam(`%${String(filter.value)}%`)}`;
        break;
      case 'in': {
        const values = Array.isArray(filter.value) ? filter.value : [];
        const placeholders = values.map((value) => pushParam(value)).join(', ');
        expression = `${textAccessor} IN (${placeholders || "''"})`;
        break;
      }
      case 'not_in': {
        const values = Array.isArray(filter.value) ? filter.value : [];
        const placeholders = values.map((value) => pushParam(value)).join(', ');
        expression = `${textAccessor} NOT IN (${placeholders || "''"})`;
        break;
      }
      case 'exists':
        expression = `properties ? '${key}'`;
        break;
      case 'not_exists':
        expression = `NOT (properties ? '${key}')`;
        break;
      default:
        throw new Error('Unsupported string operator');
    }
  } else if (filter.valueType === 'number') {
    const numericPrefix = `(jsonb_typeof(${jsonAccessor}) = 'number' AND `;
    switch (filter.operator) {
      case 'eq':
        expression = `${numericPrefix}(${textAccessor})::numeric = ${pushParam(filter.value)})`;
        break;
      case 'neq':
        expression = `${numericPrefix}(${textAccessor})::numeric <> ${pushParam(filter.value)})`;
        break;
      case 'gt':
        expression = `${numericPrefix}(${textAccessor})::numeric > ${pushParam(filter.value)})`;
        break;
      case 'gte':
        expression = `${numericPrefix}(${textAccessor})::numeric >= ${pushParam(filter.value)})`;
        break;
      case 'lt':
        expression = `${numericPrefix}(${textAccessor})::numeric < ${pushParam(filter.value)})`;
        break;
      case 'lte':
        expression = `${numericPrefix}(${textAccessor})::numeric <= ${pushParam(filter.value)})`;
        break;
      case 'between':
        expression = `${numericPrefix}(${textAccessor})::numeric BETWEEN ${pushParam(filter.value)} AND ${pushParam(filter.secondValue)})`;
        break;
      case 'in': {
        const values = Array.isArray(filter.value) ? filter.value : [];
        const placeholders = values.map((value) => pushParam(value)).join(', ');
        expression = `${numericPrefix}(${textAccessor})::numeric IN (${placeholders || 'NULL'}))`;
        break;
      }
      case 'not_in': {
        const values = Array.isArray(filter.value) ? filter.value : [];
        const placeholders = values.map((value) => pushParam(value)).join(', ');
        expression = `${numericPrefix}(${textAccessor})::numeric NOT IN (${placeholders || 'NULL'}))`;
        break;
      }
      case 'exists':
        expression = `properties ? '${key}'`;
        break;
      case 'not_exists':
        expression = `NOT (properties ? '${key}')`;
        break;
      default:
        throw new Error('Unsupported number operator');
    }
  } else {
    switch (filter.operator) {
      case 'eq':
        expression = `(jsonb_typeof(${jsonAccessor}) = 'boolean' AND (${textAccessor})::boolean = ${pushParam(filter.value)})`;
        break;
      case 'neq':
        expression = `(jsonb_typeof(${jsonAccessor}) = 'boolean' AND (${textAccessor})::boolean <> ${pushParam(filter.value)})`;
        break;
      case 'exists':
        expression = `properties ? '${key}'`;
        break;
      case 'not_exists':
        expression = `NOT (properties ? '${key}')`;
        break;
      default:
        throw new Error('Unsupported boolean operator');
    }
  }

  return { sql: expression, nextIndex: idx };
}

function buildPropertyFiltersClause(
  filters: PropertyFilter[] | undefined,
  params: unknown[],
  startIndex: number,
) {
  if (!filters || filters.length === 0) {
    return { sql: '', nextIndex: startIndex };
  }

  let idx = startIndex;
  let sql = '';

  for (const [filterIndex, filter] of filters.entries()) {
    const built = buildPropertyFilterSql(filter, params, idx);
    idx = built.nextIndex;
    if (filterIndex === 0) {
      sql += `(${built.sql})`;
      continue;
    }

    const logic = filter.logic === 'or' ? 'OR' : 'AND';
    sql += ` ${logic} (${built.sql})`;
  }

  return { sql: `(${sql})`, nextIndex: idx };
}

function buildGroupedBaseSql(req: QueryRequest, where: string) {
  const groupBy = buildGroupBySql(req);
  if (!groupBy) {
    return null;
  }

  return {
    groupBy,
    sql: [
      `SELECT ${groupBy.select}, ${buildAggregationSql(req)}`,
      `FROM events`,
      `WHERE ${where}`,
      `GROUP BY ${groupBy.groupBy}`,
    ].join(' '),
  };
}

function buildGroupedPagination(req: QueryRequest) {
  const pageSize = Math.min(req.pageSize ?? req.limit ?? 1000, 1000);
  const page = Math.max(1, req.page ?? 1);
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

function buildGroupBySql(req: QueryRequest) {
  if (!req.groupBy) {
    return null;
  }

  if (req.groupBy.kind === 'time') {
    return {
      select: `date_trunc('${req.groupBy.bucket}', "timestamp") AS "group"`,
      groupBy: `date_trunc('${req.groupBy.bucket}', "timestamp")`,
      defaultOrderBy: `"group" ASC`,
    };
  }

  const key = sanitizePropertyKey(req.groupBy.key);
  return {
    select: `properties->>'${key}' AS "group"`,
    groupBy: `properties->>'${key}'`,
    defaultOrderBy: `"value" DESC`,
  };
}

function buildOrderBySql(req: QueryRequest, grouped: boolean) {
  if (!grouped) {
    return '';
  }

  if (req.sort) {
    const field = req.sort.field === 'group' ? `"group"` : `"value"`;
    const direction = req.sort.direction.toUpperCase();
    return `ORDER BY ${field} ${direction}`;
  }

  const groupedSql = buildGroupBySql(req);
  return groupedSql ? `ORDER BY ${groupedSql.defaultOrderBy}` : '';
}

export async function executeQuery(req: QueryRequest): Promise<QueryResult> {
  const startTime = Date.now();

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

  // `buildPropertyFiltersClause` mutates `params` as it assigns placeholders.
  // It returns the last placeholder index it consumed so the caller can keep
  // parameter numbering aligned with the surrounding WHERE clause assembly.
  const propertyFilters = buildPropertyFiltersClause(
    req.propertyFilters,
    params,
    idx - 1,
  );
  idx = propertyFilters.nextIndex + 1;

  if (propertyFilters.sql) {
    conditions.push(propertyFilters.sql);
  }

  const where = conditions.join(' AND ');
  const groupedBase = buildGroupedBaseSql(req, where);

  if (!groupedBase) {
    const sql = `SELECT ${buildAggregationSql(req)} FROM events WHERE ${where}`;
    const rows = (await prisma.$queryRawUnsafe(sql, ...params)) as Record<
      string,
      unknown
    >[];

    return {
      results: rows.map(serialiseRow),
      totalCount: rows.length,
      executionTimeMs: Date.now() - startTime,
    };
  }

  const { page, pageSize, offset } = buildGroupedPagination(req);

  // Count the grouped subquery before applying LIMIT/OFFSET so the UI can
  // render stable pagination metadata for grouped result browsing.
  const countSql = `SELECT COUNT(*) AS "count" FROM (${groupedBase.sql}) grouped_results`;
  const countRows = (await prisma.$queryRawUnsafe(countSql, ...params)) as Array<{
    count: bigint | number;
  }>;
  const totalCount = Number(countRows[0]?.count ?? 0);
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);

  const rowsSql = [
    groupedBase.sql,
    buildOrderBySql(req, true),
    `LIMIT ${pageSize}`,
    `OFFSET ${offset}`,
  ]
    .filter(Boolean)
    .join(' ');

  const rows = (await prisma.$queryRawUnsafe(rowsSql, ...params)) as Record<
    string,
    unknown
  >[];

  return {
    results: rows.map(serialiseRow),
    totalCount,
    executionTimeMs: Date.now() - startTime,
    pagination: {
      page,
      pageSize,
      totalPages,
    },
  };
}
