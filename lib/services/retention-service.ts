import { prisma } from '@/lib/db/prisma';

export type RunRetentionInput = {
  applicationId: string;
  interval: 'daily' | 'weekly';
  cohortWindow: {
    value: number;
    unit: 'days' | 'weeks';
  };
  returnEventName?: string;
};

export type RetentionCell = {
  bucket: string;
  users: number;
  rate: number;
};

export type RetentionCohortRow = {
  cohortStart: string;
  cohortSize: number;
  cells: RetentionCell[];
};

export type RetentionResult = {
  applicationId: string;
  interval: 'daily' | 'weekly';
  buckets: string[];
  cohorts: RetentionCohortRow[];
};

type CohortSizeRow = {
  cohort_start: Date | string;
  cohort_size: bigint | number;
};

type ActivityRow = {
  cohort_start: Date | string;
  bucket_index: number;
  users: bigint | number;
};

function getLookbackDays(input: RunRetentionInput) {
  return input.cohortWindow.unit === 'weeks'
    ? input.cohortWindow.value * 7
    : input.cohortWindow.value;
}

function getBucketCount(input: RunRetentionInput, lookbackDays: number) {
  return input.interval === 'weekly'
    ? Math.max(1, Math.ceil(lookbackDays / 7))
    : lookbackDays;
}

function getBucketLabel(interval: RunRetentionInput['interval'], index: number) {
  return `${interval === 'weekly' ? 'W' : 'D'}${index}`;
}

function subtractDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

function normalizeDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

export async function runRetention(
  input: RunRetentionInput,
): Promise<RetentionResult> {
  const lookbackDays = getLookbackDays(input);
  const bucketCount = getBucketCount(input, lookbackDays);
  const bucketLabels = Array.from({ length: bucketCount }, (_, index) =>
    getBucketLabel(input.interval, index),
  );

  const intervalUnit = input.interval === 'weekly' ? 'week' : 'day';
  const bucketSeconds = input.interval === 'weekly' ? 7 * 86_400 : 86_400;
  const now = new Date();
  const start = subtractDays(now, lookbackDays);

  const cohortSql = `
    WITH first_events AS (
      SELECT e."userId", MIN(e."timestamp") AS first_event_at
      FROM events e
      WHERE e."applicationId" = $1
        AND e."timestamp" >= $2
        AND e."timestamp" < $3
      GROUP BY e."userId"
    ),
    cohort_users AS (
      SELECT
        fe."userId",
        DATE_TRUNC('${intervalUnit}', fe.first_event_at AT TIME ZONE 'UTC') AS cohort_start
      FROM first_events fe
    )
    SELECT
      cu.cohort_start AS cohort_start,
      COUNT(*)::bigint AS cohort_size
    FROM cohort_users cu
    GROUP BY cu.cohort_start
    ORDER BY cu.cohort_start DESC
  `;

  const cohortRows = await prisma.$queryRawUnsafe<CohortSizeRow[]>(
    cohortSql,
    input.applicationId,
    start,
    now,
  );

  const activityParams: unknown[] = [input.applicationId, start, now];
  let nextParam = activityParams.length;
  let returnEventClause = '';

  if (input.returnEventName) {
    activityParams.push(input.returnEventName);
    returnEventClause = `AND e."eventName" = $${++nextParam}`;
  }

  const activitySql = `
    WITH first_events AS (
      SELECT e."userId", MIN(e."timestamp") AS first_event_at
      FROM events e
      WHERE e."applicationId" = $1
        AND e."timestamp" >= $2
        AND e."timestamp" < $3
      GROUP BY e."userId"
    ),
    cohort_users AS (
      SELECT
        fe."userId",
        DATE_TRUNC('${intervalUnit}', fe.first_event_at AT TIME ZONE 'UTC') AS cohort_start
      FROM first_events fe
    )
    SELECT
      cu.cohort_start AS cohort_start,
      FLOOR(
        EXTRACT(
          EPOCH FROM (
            DATE_TRUNC('${intervalUnit}', e."timestamp" AT TIME ZONE 'UTC') - cu.cohort_start
          )
        ) / ${bucketSeconds}
      )::int AS bucket_index,
      COUNT(DISTINCT cu."userId")::bigint AS users
    FROM cohort_users cu
    JOIN events e
      ON e."applicationId" = $1
     AND e."userId" = cu."userId"
    WHERE e."timestamp" >= $2
      AND e."timestamp" < $3
      AND DATE_TRUNC('${intervalUnit}', e."timestamp" AT TIME ZONE 'UTC') >= cu.cohort_start
      ${returnEventClause}
    GROUP BY cu.cohort_start, bucket_index
    ORDER BY cu.cohort_start DESC, bucket_index ASC
  `;

  const activityRows = await prisma.$queryRawUnsafe<ActivityRow[]>(
    activitySql,
    ...activityParams,
  );

  const rowByCohort = new Map<
    string,
    {
      cohortSize: number;
      cells: RetentionCell[];
    }
  >();

  for (const cohortRow of cohortRows) {
    const cohortStart = normalizeDate(cohortRow.cohort_start);
    const cohortSize = Number(cohortRow.cohort_size);

    rowByCohort.set(cohortStart, {
      cohortSize,
      cells: bucketLabels.map((bucket) => ({
        bucket,
        users: 0,
        rate: 0,
      })),
    });
  }

  for (const activityRow of activityRows) {
    if (activityRow.bucket_index < 0 || activityRow.bucket_index >= bucketCount) {
      continue;
    }

    const cohortStart = normalizeDate(activityRow.cohort_start);
    const row = rowByCohort.get(cohortStart);
    if (!row) continue;

    const users = Number(activityRow.users);
    row.cells[activityRow.bucket_index] = {
      bucket: bucketLabels[activityRow.bucket_index],
      users,
      rate: row.cohortSize > 0 ? users / row.cohortSize : 0,
    };
  }

  return {
    applicationId: input.applicationId,
    interval: input.interval,
    buckets: bucketLabels,
    cohorts: Array.from(rowByCohort.entries()).map(([cohortStart, row]) => ({
      cohortStart,
      cohortSize: row.cohortSize,
      cells: row.cells,
    })),
  };
}
