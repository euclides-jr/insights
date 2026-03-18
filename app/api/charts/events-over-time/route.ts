import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import type {
  EventsOverTimeResponse,
  TimeSeriesPoint,
} from '@/lib/charts/types';
import { requireAuth } from '@/lib/auth/api-auth';

// ─── Param validation ─────────────────────────────────────────────────────────

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  applicationId: z.string().uuid().optional(),
});

// ─── Raw row shape returned from PostgreSQL ───────────────────────────────────

interface RawRow {
  date: string;
  count: number | bigint;
}

// ─── GET /api/charts/events-over-time ────────────────────────────────────────
// Returns daily event counts for a given time window, filling date gaps
// with count = 0 (FR-010).

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;
  const { searchParams } = new URL(request.url);
  const raw = {
    days: searchParams.get('days') ?? undefined,
    applicationId: searchParams.get('applicationId') ?? undefined,
  };

  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json({ error: first.message }, { status: 400 });
  }

  const { days, applicationId } = parsed.data;

  // Build the start date: (days - 1) days back so we get exactly `days` rows
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  try {
    const appFilter = applicationId
      ? Prisma.sql`AND "applicationId" = ${applicationId}`
      : Prisma.sql``;

    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        gs.day::text   AS date,
        COALESCE(e.cnt, 0)::int AS count
      FROM (
        SELECT generate_series(
          ${startDate}::date,
          CURRENT_DATE::date,
          '1 day'::interval
        )::date AS day
      ) gs
      LEFT JOIN (
        SELECT
          timestamp::date  AS day,
          COUNT(*)::int    AS cnt
        FROM events
        WHERE timestamp >= ${startDate}
        ${appFilter}
        GROUP BY timestamp::date
      ) e ON gs.day = e.day
      ORDER BY gs.day ASC
    `);

    const series: TimeSeriesPoint[] = rows.map((r) => ({
      date: r.date,
      count: Number(r.count),
    }));

    const totalCount = series.reduce((sum, p) => sum + p.count, 0);

    const response: EventsOverTimeResponse = {
      series,
      totalCount,
      windowDays: days,
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
