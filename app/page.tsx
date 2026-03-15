import { Prisma } from '@prisma/client';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { prisma } from '@/lib/db/prisma';
import { formatRelativeTime, formatNumber } from '@/lib/format';
import { EventVolumeChart } from '@/components/charts/EventVolumeChart';
import { EventsByApplicationChart } from '@/components/charts/EventsByApplicationChart';
import type {
  TimeSeriesPoint,
  ApplicationEventCount,
} from '@/lib/charts/types';

export default async function DashboardPage() {
  // Shared start date for 7-day charts
  const chartStartDate = new Date();
  chartStartDate.setDate(chartStartDate.getDate() - 6);
  chartStartDate.setHours(0, 0, 0, 0);

  // Fetch metrics + chart data in parallel
  const [
    totalEvents,
    activeApplications,
    eventSchemas,
    recentEvents,
    eventSeriesRows,
    appCountRows,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.application.count(),
    prisma.eventSchema.count({ where: { isActive: true } }),
    prisma.event.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
      include: { application: true },
    }),
    // T008: initial 7-day event volume series
    prisma.$queryRaw<{ date: string; count: number }[]>(Prisma.sql`
        SELECT
          gs.day::text   AS date,
          COALESCE(e.cnt, 0)::int AS count
        FROM (
          SELECT generate_series(
            ${chartStartDate}::date,
            CURRENT_DATE::date,
            '1 day'::interval
          )::date AS day
        ) gs
        LEFT JOIN (
          SELECT timestamp::date AS day, COUNT(*)::int AS cnt
          FROM events
          WHERE timestamp >= ${chartStartDate}
          GROUP BY timestamp::date
        ) e ON gs.day = e.day
        ORDER BY gs.day ASC
      `),
    // T016: initial events-by-application data
    prisma.$queryRaw<
      { applicationId: string; applicationName: string; count: number }[]
    >(Prisma.sql`
        SELECT
          a.id   AS "applicationId",
          a.name AS "applicationName",
          COUNT(e.id)::int AS count
        FROM applications a
        LEFT JOIN events e ON e."applicationId" = a.id AND e.timestamp >= ${chartStartDate}
        GROUP BY a.id, a.name
        ORDER BY count DESC
      `),
  ]);

  const initialEventSeries: TimeSeriesPoint[] = eventSeriesRows.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));

  const initialAppCounts: ApplicationEventCount[] = appCountRows.map((r) => ({
    applicationId: r.applicationId,
    applicationName: r.applicationName,
    count: Number(r.count),
  }));

  const metrics = [
    {
      label: 'Total Events',
      value: formatNumber(totalEvents),
      change: '+12.5%',
      trend: 'up' as const,
    },
    {
      label: 'Active Applications',
      value: activeApplications.toString(),
      change: '+3',
      trend: 'up' as const,
    },
    {
      label: 'Event Schemas',
      value: eventSchemas.toString(),
      change: '0',
      trend: 'neutral' as const,
    },
    {
      label: 'Data Volume',
      value: '1.8TB',
      change: '+8.2%',
      trend: 'up' as const,
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-12 space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-[#7A7A7A]">
            Overview of your event analytics platform
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="bg-white border border-[#E8E8E8] p-6"
            >
              <p className="text-sm text-[#7A7A7A]">{metric.label}</p>
              <p className="mt-2 text-3xl font-semibold">{metric.value}</p>
              <p
                className={`mt-2 text-sm ${
                  metric.trend === 'up' ? 'text-[#22C55E]' : 'text-[#7A7A7A]'
                }`}
              >
                {metric.change}
              </p>
            </div>
          ))}
        </div>

        {/* Recent Events */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold font-[family-name:var(--font-space-grotesk)]">
              Recent Events
            </h2>
            <a
              href="/events"
              className="text-sm text-[#E42313] hover:underline"
            >
              View all events →
            </a>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableCell
                  width="120px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Event ID
                </TableCell>
                <TableCell
                  width="220px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Event Name
                </TableCell>
                <TableCell
                  width="220px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Application
                </TableCell>
                <TableCell
                  width="180px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Timestamp
                </TableCell>
                <TableCell
                  width="140px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Status
                </TableCell>
              </TableRow>
            </TableHeader>
            {recentEvents.map((event) => (
              <TableRow key={event.id}>
                <TableCell width="120px">
                  {event.eventId.slice(0, 12)}
                </TableCell>
                <TableCell width="220px" className="font-medium">
                  {event.eventName}
                </TableCell>
                <TableCell width="220px" className="text-[#7A7A7A]">
                  {event.application.name}
                </TableCell>
                <TableCell width="180px" className="text-[#7A7A7A]">
                  {formatRelativeTime(event.timestamp)}
                </TableCell>
                <TableCell width="140px">
                  <Badge variant="success">Success</Badge>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </div>

        {/* Event Volume Chart — US1 */}
        <EventVolumeChart initialData={initialEventSeries} />

        {/* Events by Application Chart — US4 */}
        <EventsByApplicationChart data={initialAppCounts} />
      </div>
    </DashboardLayout>
  );
}
