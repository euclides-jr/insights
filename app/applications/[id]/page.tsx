import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { ApplicationApiKey } from '@/components/application-api-key';
import { EventVolumeChart } from '@/components/charts/EventVolumeChart';
import { prisma } from '@/lib/db/prisma';
import { formatRelativeTime, formatDateTime, formatNumber } from '@/lib/format';
import type { TimeSeriesPoint } from '@/lib/charts/types';

type Props = { params: Promise<{ id: string }> };

export default async function ApplicationDetailPage({ params }: Props) {
  const { id } = await params;

  // 7-day window for initial chart data
  const chartStart = new Date();
  chartStart.setDate(chartStart.getDate() - 6);
  chartStart.setHours(0, 0, 0, 0);

  const [
    application,
    totalEvents,
    uniqueUsers,
    activeSchemas,
    totalSegments,
    recentEvents,
    schemas,
    segments,
    eventSeriesRows,
  ] = await Promise.all([
    prisma.application.findUnique({ where: { id } }),

    prisma.event.count({ where: { applicationId: id } }),

    prisma.userProfile.count({ where: { applicationId: id } }),

    prisma.eventSchema.count({ where: { applicationId: id, isActive: true } }),

    prisma.segment.count({ where: { applicationId: id } }),

    prisma.event.findMany({
      where: { applicationId: id },
      take: 10,
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        eventId: true,
        eventName: true,
        userId: true,
        timestamp: true,
        properties: true,
      },
    }),

    prisma.eventSchema.findMany({
      where: { applicationId: id },
      orderBy: [{ eventName: 'asc' }, { version: 'desc' }],
      select: {
        id: true,
        eventName: true,
        version: true,
        isActive: true,
        createdAt: true,
      },
    }),

    prisma.segment.findMany({
      where: { applicationId: id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        memberCount: true,
        lastRefreshedAt: true,
        updatedAt: true,
      },
    }),

    // Gap-filled 7-day event series for the chart
    prisma.$queryRaw<{ date: string; count: number }[]>(Prisma.sql`
      SELECT
        gs.day::text        AS date,
        COALESCE(e.cnt, 0)::int AS count
      FROM (
        SELECT generate_series(
          ${chartStart}::date,
          CURRENT_DATE::date,
          '1 day'::interval
        )::date AS day
      ) gs
      LEFT JOIN (
        SELECT timestamp::date AS day, COUNT(*)::int AS cnt
        FROM events
        WHERE timestamp >= ${chartStart}
          AND "applicationId" = ${id}
        GROUP BY timestamp::date
      ) e ON gs.day = e.day
      ORDER BY gs.day ASC
    `),
  ]);

  if (!application) notFound();

  const initialSeries: TimeSeriesPoint[] = eventSeriesRows.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));

  const statusVariant =
    application.status === 'ACTIVE'
      ? 'success'
      : application.status === 'INACTIVE'
        ? 'neutral'
        : 'paused';

  return (
    <DashboardLayout>
      <div className="p-12 space-y-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#7A7A7A]">
          <Link
            href="/applications"
            className="hover:text-[#0D0D0D] transition-colors"
          >
            Applications
          </Link>
          <span>/</span>
          <span className="text-[#0D0D0D] font-medium">{application.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
                {application.name}
              </h1>
              <Badge variant={statusVariant}>
                {application.status.charAt(0) +
                  application.status.slice(1).toLowerCase()}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[#7A7A7A]">
              Created {formatDateTime(application.createdAt)} · Last updated{' '}
              {formatRelativeTime(application.updatedAt)}
            </p>
          </div>
        </div>

        {/* Metadata card */}
        <div className="border border-[#E8E8E8] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#7A7A7A] uppercase tracking-wider">
            Configuration
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-[#7A7A7A] mb-1">Application ID</p>
              <code className="text-sm font-mono text-[#0D0D0D]">
                {application.id}
              </code>
            </div>
            <div>
              <p className="text-xs text-[#7A7A7A] mb-1">API Key</p>
              <ApplicationApiKey apiKey={application.apiKey} />
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div className="border border-[#E8E8E8] p-6">
            <p className="text-xs text-[#7A7A7A] mb-1">Total Events</p>
            <p className="text-3xl font-semibold font-[family-name:var(--font-space-grotesk)]">
              {formatNumber(totalEvents)}
            </p>
          </div>
          <div className="border border-[#E8E8E8] p-6">
            <p className="text-xs text-[#7A7A7A] mb-1">Unique Users</p>
            <p className="text-3xl font-semibold font-[family-name:var(--font-space-grotesk)]">
              {formatNumber(uniqueUsers)}
            </p>
          </div>
          <div className="border border-[#E8E8E8] p-6">
            <p className="text-xs text-[#7A7A7A] mb-1">Active Schemas</p>
            <p className="text-3xl font-semibold font-[family-name:var(--font-space-grotesk)]">
              {formatNumber(activeSchemas)}
            </p>
          </div>
          <div className="border border-[#E8E8E8] p-6">
            <p className="text-xs text-[#7A7A7A] mb-1">Segments</p>
            <p className="text-3xl font-semibold font-[family-name:var(--font-space-grotesk)]">
              {formatNumber(totalSegments)}
            </p>
          </div>
        </div>

        {/* Event volume chart */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-space-grotesk)]">
            Event Volume
          </h2>
          <EventVolumeChart
            initialData={initialSeries}
            applicationId={application.id}
          />
        </div>

        {/* Recent Events */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-[family-name:var(--font-space-grotesk)]">
              Recent Events
            </h2>
            <Link
              href={`/events?appId=${application.id}`}
              className="text-sm text-[#7A7A7A] hover:text-[#0D0D0D] transition-colors"
            >
              View all →
            </Link>
          </div>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-[#7A7A7A] py-8 text-center border border-[#E8E8E8]">
              No events yet. Start sending events using the API key above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell
                    width="220px"
                    className="font-medium text-xs text-[#7A7A7A]"
                  >
                    Event Name
                  </TableCell>
                  <TableCell
                    width="180px"
                    className="font-medium text-xs text-[#7A7A7A]"
                  >
                    User ID
                  </TableCell>
                  <TableCell
                    width="200px"
                    className="font-medium text-xs text-[#7A7A7A]"
                  >
                    Timestamp
                  </TableCell>
                  <TableCell className="font-medium text-xs text-[#7A7A7A]">
                    Properties
                  </TableCell>
                </TableRow>
              </TableHeader>
              {recentEvents.map((event) => {
                const props = event.properties as Record<string, unknown>;
                const propCount = Object.keys(props).length;
                return (
                  <TableRow key={event.id}>
                    <TableCell width="220px" className="font-medium">
                      {event.eventName}
                    </TableCell>
                    <TableCell
                      width="180px"
                      className="text-[#7A7A7A] font-mono text-xs"
                    >
                      {event.userId}
                    </TableCell>
                    <TableCell width="200px" className="text-[#7A7A7A]">
                      {formatDateTime(event.timestamp)}
                    </TableCell>
                    <TableCell className="text-[#7A7A7A] text-xs">
                      {propCount === 0
                        ? '—'
                        : `${propCount} propert${propCount === 1 ? 'y' : 'ies'}`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </Table>
          )}
        </div>

        {/* Event Schemas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-[family-name:var(--font-space-grotesk)]">
              Event Schemas
            </h2>
            <Link
              href="/schemas"
              className="text-sm text-[#7A7A7A] hover:text-[#0D0D0D] transition-colors"
            >
              Manage schemas →
            </Link>
          </div>
          {schemas.length === 0 ? (
            <p className="text-sm text-[#7A7A7A] py-8 text-center border border-[#E8E8E8]">
              No schemas defined.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell
                    width="260px"
                    className="font-medium text-xs text-[#7A7A7A]"
                  >
                    Event Name
                  </TableCell>
                  <TableCell
                    width="100px"
                    className="font-medium text-xs text-[#7A7A7A]"
                  >
                    Version
                  </TableCell>
                  <TableCell
                    width="120px"
                    className="font-medium text-xs text-[#7A7A7A]"
                  >
                    Status
                  </TableCell>
                  <TableCell className="font-medium text-xs text-[#7A7A7A]">
                    Created
                  </TableCell>
                </TableRow>
              </TableHeader>
              {schemas.map((schema) => (
                <TableRow key={schema.id}>
                  <TableCell width="260px" className="font-medium">
                    <Link
                      href={`/schemas/${schema.id}`}
                      className="hover:underline"
                    >
                      {schema.eventName}
                    </Link>
                  </TableCell>
                  <TableCell width="100px" className="text-[#7A7A7A]">
                    v{schema.version}
                  </TableCell>
                  <TableCell width="120px">
                    <Badge variant={schema.isActive ? 'success' : 'neutral'}>
                      {schema.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[#7A7A7A]">
                    {formatRelativeTime(schema.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </div>

        {/* Segments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-[family-name:var(--font-space-grotesk)]">
              Segments
            </h2>
            <Link
              href="/segments"
              className="text-sm text-[#7A7A7A] hover:text-[#0D0D0D] transition-colors"
            >
              Manage segments →
            </Link>
          </div>
          {segments.length === 0 ? (
            <p className="text-sm text-[#7A7A7A] py-8 text-center border border-[#E8E8E8]">
              No segments defined.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell
                    width="260px"
                    className="font-medium text-xs text-[#7A7A7A]"
                  >
                    Name
                  </TableCell>
                  <TableCell
                    width="140px"
                    className="font-medium text-xs text-[#7A7A7A]"
                  >
                    Members
                  </TableCell>
                  <TableCell
                    width="140px"
                    className="font-medium text-xs text-[#7A7A7A]"
                  >
                    Status
                  </TableCell>
                  <TableCell className="font-medium text-xs text-[#7A7A7A]">
                    Last Refreshed
                  </TableCell>
                </TableRow>
              </TableHeader>
              {segments.map((seg) => (
                <TableRow key={seg.id}>
                  <TableCell width="260px" className="font-medium">
                    <Link
                      href={`/segments/${seg.id}`}
                      className="hover:underline"
                    >
                      {seg.name}
                    </Link>
                  </TableCell>
                  <TableCell width="140px">
                    {formatNumber(seg.memberCount)}
                  </TableCell>
                  <TableCell width="140px">
                    <Badge
                      variant={seg.memberCount > 0 ? 'success' : 'neutral'}
                    >
                      {seg.memberCount > 0 ? 'Active' : 'Empty'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[#7A7A7A]">
                    {formatRelativeTime(seg.lastRefreshedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
