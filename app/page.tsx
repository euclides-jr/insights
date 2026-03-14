import { DashboardLayout } from '@/components/dashboard-layout';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { prisma } from '@/lib/db/prisma';
import { formatRelativeTime, formatNumber } from '@/lib/format';

export default async function DashboardPage() {
  // Fetch metrics
  const [totalEvents, activeApplications, eventSchemas, recentEvents] =
    await Promise.all([
      prisma.event.count(),
      prisma.application.count(),
      prisma.eventSchema.count({ where: { isActive: true } }),
      prisma.event.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' },
        include: { application: true },
      }),
    ]);

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

        {/* Event Trends Chart Placeholder */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold font-[family-name:var(--font-space-grotesk)]">
            Event Trends
          </h2>
          <div className="bg-white border border-[#E8E8E8] p-8 h-64 flex items-center justify-center">
            <p className="text-[#B0B0B0]">Chart visualization placeholder</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
