import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { QualityAppFilter } from '@/components/quality-app-filter';
import { QualityTrendsChart } from '@/components/charts/QualityTrendsChart';
import { prisma } from '@/lib/db/prisma';
import { format } from 'date-fns';
import {
  failureRateAlert,
  completenessAlert,
  duplicateRateAlert,
  overallAlert,
  THRESHOLDS,
  type AlertLevel,
} from '@/app/api/quality/route';
import type { QualityTrendPoint } from '@/lib/charts/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function alertBadge(level: AlertLevel) {
  const map: Record<
    AlertLevel,
    { variant: 'success' | 'warning' | 'error'; label: string }
  > = {
    ok: { variant: 'success', label: 'OK' },
    warning: { variant: 'warning', label: 'Warning' },
    error: { variant: 'error', label: 'Alert' },
  };
  const { variant, label } = map[level];
  return <Badge variant={variant}>{label}</Badge>;
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function QualityPage({
  searchParams,
}: {
  searchParams: Promise<{
    applicationId?: string;
    days?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const applicationId = params.applicationId ?? '';
  const days = Math.min(90, Math.max(1, Number(params.days ?? '7')));
  const currentPage = Math.max(1, Number(params.page ?? '1'));
  const pageSize = 20;
  const skip = (currentPage - 1) * pageSize;

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const where = {
    date: { gte: since },
    ...(applicationId ? { applicationId } : {}),
  };

  const [metrics, totalCount, applications, summary, qualityTrendsRows] =
    await Promise.all([
      prisma.dataQualityMetric.findMany({
        where,
        take: pageSize,
        skip,
        orderBy: [{ date: 'desc' }, { applicationId: 'asc' }],
        include: { application: { select: { id: true, name: true } } },
      }),
      prisma.dataQualityMetric.count({ where }),
      prisma.application.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.dataQualityMetric.aggregate({
        where,
        _sum: { eventsReceived: true, eventsRejected: true },
        _avg: {
          validationFailureRate: true,
          completenessRate: true,
          duplicateRate: true,
        },
      }),
      // T011: initial quality trends series for chart (null gap days — FR-010)
      applicationId
        ? prisma.$queryRaw<
            {
              date: string;
              validationFailureRate: number | null;
              completenessRate: number | null;
              duplicateRate: number | null;
            }[]
          >(Prisma.sql`
          SELECT
            gs.day::text                    AS date,
            dqm."validationFailureRate"     AS "validationFailureRate",
            dqm."completenessRate"              AS "completenessRate",
            dqm."duplicateRate"              AS "duplicateRate"
          FROM (
            SELECT generate_series(${since}::date, CURRENT_DATE::date, '1 day')::date AS day
          ) gs
          LEFT JOIN data_quality_metrics dqm
            ON dqm.date::date = gs.day
            AND dqm."applicationId" = ${applicationId}
          ORDER BY gs.day ASC
        `)
        : prisma.$queryRaw<
            {
              date: string;
              validationFailureRate: number | null;
              completenessRate: number | null;
              duplicateRate: number | null;
            }[]
          >(Prisma.sql`
          SELECT
            gs.day::text                      AS date,
            AVG(dqm."validationFailureRate")  AS "validationFailureRate",
            AVG(dqm."completenessRate")        AS "completenessRate",
            AVG(dqm."duplicateRate")           AS "duplicateRate"
          FROM (
            SELECT generate_series(${since}::date, CURRENT_DATE::date, '1 day')::date AS day
          ) gs
          LEFT JOIN data_quality_metrics dqm ON dqm.date::date = gs.day
          GROUP BY gs.day
          ORDER BY gs.day ASC
        `),
    ]);

  const initialTrendsSeries: QualityTrendPoint[] = qualityTrendsRows.map(
    (r) => ({
      date: r.date,
      validationFailureRate:
        r.validationFailureRate !== null
          ? Number(r.validationFailureRate)
          : null,
      completenessRate:
        r.completenessRate !== null ? Number(r.completenessRate) : null,
      duplicateRate: r.duplicateRate !== null ? Number(r.duplicateRate) : null,
    }),
  );

  const totalPages = Math.ceil(totalCount / pageSize);
  const showingStart = totalCount === 0 ? 0 : skip + 1;
  const showingEnd = Math.min(skip + pageSize, totalCount);

  const avgFailure = summary._avg.validationFailureRate ?? 0;
  const avgCompleteness = summary._avg.completenessRate ?? 1;
  const avgDuplicate = summary._avg.duplicateRate ?? 0;

  const overallStatus = overallAlert(
    failureRateAlert(avgFailure),
    completenessAlert(avgCompleteness),
    duplicateRateAlert(avgDuplicate),
  );

  const summaryCards = [
    {
      label: 'Events Received',
      value: (summary._sum.eventsReceived ?? 0).toLocaleString(),
      sub: `last ${days} days`,
    },
    {
      label: 'Events Rejected',
      value: (summary._sum.eventsRejected ?? 0).toLocaleString(),
      sub: `avg ${pct(avgFailure)} failure rate`,
      alert: failureRateAlert(avgFailure),
    },
    {
      label: 'Avg Completeness',
      value: pct(avgCompleteness),
      sub: `threshold: ${pct(THRESHOLDS.completenessRate.warning)}`,
      alert: completenessAlert(avgCompleteness),
    },
    {
      label: 'Avg Duplicate Rate',
      value: pct(avgDuplicate),
      sub: `threshold: ${pct(THRESHOLDS.duplicateRate.warning)}`,
      alert: duplicateRateAlert(avgDuplicate),
    },
  ];

  // Build URL helpers for filters
  function filterUrl(p: Record<string, string>) {
    const sp = new URLSearchParams();
    if (applicationId) sp.set('applicationId', applicationId);
    sp.set('days', String(days));
    sp.set('page', '1');
    Object.entries(p).forEach(([k, v]) => sp.set(k, v));
    return `/quality?${sp.toString()}`;
  }

  const annotated = metrics.map((m) => ({
    ...m,
    overallAlert: overallAlert(
      failureRateAlert(m.validationFailureRate),
      completenessAlert(m.completenessRate),
      duplicateRateAlert(m.duplicateRate),
    ),
  }));

  return (
    <DashboardLayout>
      <div className="p-12 space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
                Data Quality
              </h1>
              {alertBadge(overallStatus)}
            </div>
            <p className="mt-1 text-sm text-[#7A7A7A]">
              Monitor validation failure rates, completeness, and duplicate
              events
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-shrink-0 pt-2">
            {/* Application picker */}
            <QualityAppFilter
              applications={applications}
              selectedId={applicationId}
              days={days}
            />

            {/* Days filter */}
            <div className="flex items-center border border-[#E8E8E8] bg-white text-sm overflow-hidden">
              {[7, 14, 30].map((d) => (
                <Link
                  key={d}
                  href={filterUrl({ days: String(d) })}
                  className={`px-3 h-9 flex items-center transition-colors ${
                    days === d
                      ? 'bg-[#0D0D0D] text-white'
                      : 'text-[#7A7A7A] hover:bg-[#FAFAFA]'
                  }`}
                >
                  {d}d
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="bg-white border border-[#E8E8E8] p-5 space-y-2"
            >
              <p className="text-xs text-[#7A7A7A] font-(family-name:--font-space-grotesk)">
                {card.label}
              </p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-semibold font-(family-name:--font-space-grotesk)">
                  {card.value}
                </p>
                {card.alert && card.alert !== 'ok' && alertBadge(card.alert)}
              </div>
              <p className="text-xs text-[#7A7A7A]">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Thresholds reference */}
        <div className="flex items-center gap-6 text-xs text-[#7A7A7A] bg-[#FAFAFA] border border-[#E8E8E8] px-4 py-3">
          <span className="font-medium text-[#0D0D0D]">Alert thresholds</span>
          <span>
            Failure rate: warning ≥
            {pct(THRESHOLDS.validationFailureRate.warning)}, alert ≥
            {pct(THRESHOLDS.validationFailureRate.error)}
          </span>
          <span>
            Completeness: warning ≤{pct(THRESHOLDS.completenessRate.warning)},
            alert ≤{pct(THRESHOLDS.completenessRate.error)}
          </span>
          <span>
            Duplicates: warning ≥{pct(THRESHOLDS.duplicateRate.warning)}, alert
            ≥{pct(THRESHOLDS.duplicateRate.error)}
          </span>
        </div>

        {/* Quality Trends Chart — US2 */}
        <QualityTrendsChart
          initialData={initialTrendsSeries}
          applicationId={applicationId || undefined}
          days={days}
        />

        {/* Metrics table */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
            Daily Breakdown
          </h2>

          {annotated.length === 0 ? (
            <div className="bg-white border border-[#E8E8E8] px-6 py-16 text-center text-sm text-[#7A7A7A]">
              No data quality metrics yet. Send events with active schemas to
              start tracking.
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      { label: 'Date', width: '120px' },
                      { label: 'Application', width: '180px' },
                      { label: 'Received', width: '100px' },
                      { label: 'Rejected', width: '100px' },
                      { label: 'Failure Rate', width: '120px' },
                      { label: 'Completeness', width: '120px' },
                      { label: 'Duplicate Rate', width: '120px' },
                      { label: 'Status', width: '100px' },
                    ].map(({ label, width }) => (
                      <TableCell
                        key={label}
                        width={width}
                        className="font-medium text-xs text-[#7A7A7A]"
                      >
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHeader>

                {annotated.map((m) => {
                  const failAlert = failureRateAlert(m.validationFailureRate);
                  const compAlert = completenessAlert(m.completenessRate);
                  const dupAlert = duplicateRateAlert(m.duplicateRate);
                  return (
                    <TableRow
                      key={m.id}
                      className="hover:bg-[#FAFAFA] transition-colors"
                    >
                      <TableCell width="120px" className="font-mono text-xs">
                        {format(m.date, 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell width="180px">{m.application.name}</TableCell>
                      <TableCell width="100px">
                        {m.eventsReceived.toLocaleString()}
                      </TableCell>
                      <TableCell width="100px">
                        {m.eventsRejected.toLocaleString()}
                      </TableCell>
                      <TableCell width="120px">
                        <span
                          className={
                            failAlert === 'error'
                              ? 'text-red-500 font-medium'
                              : failAlert === 'warning'
                                ? 'text-amber-500 font-medium'
                                : ''
                          }
                        >
                          {pct(m.validationFailureRate)}
                        </span>
                      </TableCell>
                      <TableCell width="120px">
                        <span
                          className={
                            compAlert === 'error'
                              ? 'text-red-500 font-medium'
                              : compAlert === 'warning'
                                ? 'text-amber-500 font-medium'
                                : ''
                          }
                        >
                          {pct(m.completenessRate)}
                        </span>
                      </TableCell>
                      <TableCell width="120px">
                        <span
                          className={
                            dupAlert === 'error'
                              ? 'text-red-500 font-medium'
                              : dupAlert === 'warning'
                                ? 'text-amber-500 font-medium'
                                : ''
                          }
                        >
                          {pct(m.duplicateRate)}
                        </span>
                      </TableCell>
                      <TableCell width="100px">
                        {alertBadge(m.overallAlert)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Table>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                showing={`Showing ${showingStart}–${showingEnd} of ${totalCount} rows`}
              />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
