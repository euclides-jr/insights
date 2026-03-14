import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// ─── Alert thresholds ────────────────────────────────────────────────────────

export const THRESHOLDS = {
  validationFailureRate: { warning: 0.05, error: 0.15 },
  completenessRate: { warning: 0.9, error: 0.75 }, // below = bad
  duplicateRate: { warning: 0.05, error: 0.15 },
} as const;

export type AlertLevel = 'ok' | 'warning' | 'error';

export function failureRateAlert(rate: number): AlertLevel {
  if (rate >= THRESHOLDS.validationFailureRate.error) return 'error';
  if (rate >= THRESHOLDS.validationFailureRate.warning) return 'warning';
  return 'ok';
}

export function completenessAlert(rate: number): AlertLevel {
  if (rate <= THRESHOLDS.completenessRate.error) return 'error';
  if (rate <= THRESHOLDS.completenessRate.warning) return 'warning';
  return 'ok';
}

export function duplicateRateAlert(rate: number): AlertLevel {
  if (rate >= THRESHOLDS.duplicateRate.error) return 'error';
  if (rate >= THRESHOLDS.duplicateRate.warning) return 'warning';
  return 'ok';
}

/** Highest severity among a set of levels. */
export function overallAlert(...levels: AlertLevel[]): AlertLevel {
  if (levels.includes('error')) return 'error';
  if (levels.includes('warning')) return 'warning';
  return 'ok';
}

// ─── GET /api/quality ─────────────────────────────────────────────────────────
// Returns daily data quality metrics with alert levels attached.
//
// Query params:
//   applicationId – filter to a single application
//   days          – look-back window in days (default 7, max 90)
//   page          – pagination (default 1)
//   pageSize      – rows per page (default 50, max 200)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');
    const days = Math.min(
      90,
      Math.max(1, Number(searchParams.get('days') ?? '7')),
    );
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(
      200,
      Math.max(1, Number(searchParams.get('pageSize') ?? '50')),
    );
    const skip = (page - 1) * pageSize;

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const where = {
      date: { gte: since },
      ...(applicationId ? { applicationId } : {}),
    };

    const [metrics, totalCount] = await Promise.all([
      prisma.dataQualityMetric.findMany({
        where,
        take: pageSize,
        skip,
        orderBy: [{ date: 'desc' }, { applicationId: 'asc' }],
        include: { application: { select: { id: true, name: true } } },
      }),
      prisma.dataQualityMetric.count({ where }),
    ]);

    // Attach computed alert levels to each row
    const annotated = metrics.map((m) => {
      const failureAlert = failureRateAlert(m.validationFailureRate);
      const compAlert = completenessAlert(m.completenessRate);
      const dupAlert = duplicateRateAlert(m.duplicateRate);
      return {
        ...m,
        alerts: {
          validationFailureRate: failureAlert,
          completenessRate: compAlert,
          duplicateRate: dupAlert,
          overall: overallAlert(failureAlert, compAlert, dupAlert),
        },
      };
    });

    // Summary: aggregate totals across the window (per application if filtered)
    const summary = await prisma.dataQualityMetric.aggregate({
      where,
      _sum: { eventsReceived: true, eventsRejected: true },
      _avg: {
        validationFailureRate: true,
        completenessRate: true,
        duplicateRate: true,
      },
    });

    const overallStatus = overallAlert(
      failureRateAlert(summary._avg.validationFailureRate ?? 0),
      completenessAlert(summary._avg.completenessRate ?? 1),
      duplicateRateAlert(summary._avg.duplicateRate ?? 0),
    );

    return NextResponse.json({
      metrics: annotated,
      totalCount,
      page,
      pageSize,
      summary: {
        eventsReceived: summary._sum.eventsReceived ?? 0,
        eventsRejected: summary._sum.eventsRejected ?? 0,
        avgValidationFailureRate: summary._avg.validationFailureRate ?? 0,
        avgCompletenessRate: summary._avg.completenessRate ?? 1,
        avgDuplicateRate: summary._avg.duplicateRate ?? 0,
        overallStatus,
        windowDays: days,
      },
      thresholds: THRESHOLDS,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
