import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import type {
  EventsByApplicationResponse,
  ApplicationEventCount,
} from '@/lib/charts/types';
import { requireAuth } from '@/lib/auth/api-auth';

// ─── Param validation ─────────────────────────────────────────────────────────

const QuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

// ─── Raw row shape returned from PostgreSQL ───────────────────────────────────

interface RawRow {
  applicationId: string;
  applicationName: string;
  count: number | bigint;
}

// ─── GET /api/charts/events-by-application ────────────────────────────────────
// Returns total event counts grouped by application for a given time window,
// ordered by count descending.

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;
  const { searchParams } = new URL(request.url);
  const raw = { days: searchParams.get('days') ?? undefined };

  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return NextResponse.json({ error: first.message }, { status: 400 });
  }

  const { days } = parsed.data;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  try {
    const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        a.id    AS "applicationId",
        a.name  AS "applicationName",
        COUNT(e.id)::int AS count
      FROM applications a
      LEFT JOIN events e
        ON e."applicationId" = a.id
        AND e.timestamp >= ${startDate}
      GROUP BY a.id, a.name
      ORDER BY count DESC
    `);

    const series: ApplicationEventCount[] = rows.map((r) => ({
      applicationId: r.applicationId,
      applicationName: r.applicationName,
      count: Number(r.count),
    }));

    const response: EventsByApplicationResponse = { series };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
