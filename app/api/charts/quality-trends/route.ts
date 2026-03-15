import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import type {
  QualityTrendsResponse,
  QualityTrendPoint,
} from '@/lib/charts/types';

// ─── Param validation ─────────────────────────────────────────────────────────

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  applicationId: z.string().uuid().optional(),
});

// ─── Raw row shape returned from PostgreSQL ───────────────────────────────────

interface RawRow {
  date: string;
  validationFailureRate: number | null;
  completenessRate: number | null;
  duplicateRate: number | null;
}

// ─── GET /api/charts/quality-trends ─────────────────────────────────────────
// Returns multi-metric daily quality data. Date gaps are filled with NULL
// (not 0.0) so recharts renders broken segments instead of false-zero spikes
// (FR-010).

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  try {
    let rows: RawRow[];

    if (applicationId) {
      // Single app — direct LEFT JOIN; null preserved for missing days
      rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
        SELECT
          gs.day::text                       AS date,
            dqm."validationFailureRate"        AS "validationFailureRate",
          dqm."completenessRate"              AS "completenessRate",
          dqm."duplicateRate"                 AS "duplicateRate"
        FROM (
          SELECT generate_series(
            ${startDate}::date,
            CURRENT_DATE::date,
            '1 day'::interval
          )::date AS day
        ) gs
        LEFT JOIN data_quality_metrics dqm
          ON dqm.date::date = gs.day
          AND dqm."applicationId" = ${applicationId}
        ORDER BY gs.day ASC
      `);
    } else {
      // All apps — average across applications per day; null for empty days
      rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
        SELECT
          gs.day::text                              AS date,
            AVG(dqm."validationFailureRate")          AS "validationFailureRate",
          AVG(dqm."completenessRate")                AS "completenessRate",
          AVG(dqm."duplicateRate")                   AS "duplicateRate"
        FROM (
          SELECT generate_series(
            ${startDate}::date,
            CURRENT_DATE::date,
            '1 day'::interval
          )::date AS day
        ) gs
        LEFT JOIN data_quality_metrics dqm
          ON dqm.date::date = gs.day
        GROUP BY gs.day
        ORDER BY gs.day ASC
      `);
    }

    const series: QualityTrendPoint[] = rows.map((r) => ({
      date: r.date,
      validationFailureRate:
        r.validationFailureRate !== null
          ? Number(r.validationFailureRate)
          : null,
      completenessRate:
        r.completenessRate !== null ? Number(r.completenessRate) : null,
      duplicateRate: r.duplicateRate !== null ? Number(r.duplicateRate) : null,
    }));

    const response: QualityTrendsResponse = {
      series,
      windowDays: days,
      applicationId: applicationId ?? null,
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
