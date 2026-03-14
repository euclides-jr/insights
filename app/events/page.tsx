import { DashboardLayout } from '@/components/dashboard-layout';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { prisma } from '@/lib/db/prisma';
import { formatDateTime } from '@/lib/format';

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const pageSize = 10;
  const skip = (currentPage - 1) * pageSize;

  const [events, totalCount] = await Promise.all([
    prisma.event.findMany({
      take: pageSize,
      skip,
      orderBy: { timestamp: 'desc' },
      include: { application: true },
    }),
    prisma.event.count(),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const showingStart = skip + 1;
  const showingEnd = Math.min(skip + pageSize, totalCount);

  return (
    <DashboardLayout>
      <div className="p-12 space-y-12">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
              Events
            </h1>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Track and monitor all events across your applications
            </p>
          </div>
          <Button>+ Add Event</Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          <SearchInput placeholder="Search events..." className="w-80" />
          <Button variant="secondary">
            Application
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 5L6 8L9 5H3Z" />
            </svg>
          </Button>
          <Button variant="secondary">
            Status
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 5L6 8L9 5H3Z" />
            </svg>
          </Button>
        </div>

        {/* Events Table */}
        <div className="space-y-6">
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
                  width="200px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Event Name
                </TableCell>
                <TableCell
                  width="200px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Application
                </TableCell>
                <TableCell
                  width="150px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Schema
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
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell width="120px">
                  {event.eventId.slice(0, 12)}
                </TableCell>
                <TableCell width="200px" className="font-medium">
                  {event.eventName}
                </TableCell>
                <TableCell width="200px" className="text-[#7A7A7A]">
                  {event.application.name}
                </TableCell>
                <TableCell width="150px" className="text-[#7A7A7A]">
                  {event.eventName}
                </TableCell>
                <TableCell width="180px" className="text-[#7A7A7A]">
                  {formatDateTime(event.timestamp)}
                </TableCell>
                <TableCell width="140px">
                  <Badge variant="success">Success</Badge>
                </TableCell>
              </TableRow>
            ))}
          </Table>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            showing={`Showing ${showingStart}-${showingEnd} of ${totalCount} events`}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
