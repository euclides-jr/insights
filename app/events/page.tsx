import { DashboardLayout } from "@/components/dashboard-layout";
import { Table, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { FilterDropdown } from "@/components/ui/filter-dropdown";
import { Pagination } from "@/components/ui/pagination";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/format";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; appId?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const pageSize = 10;
  const skip = (currentPage - 1) * pageSize;
  const q = params.q?.trim() || "";
  const appId = params.appId || "";

  const filters: Record<string, unknown>[] = [];
  if (q) {
    filters.push({
      OR: [
        { eventName: { contains: q, mode: "insensitive" as const } },
        { userId: { contains: q, mode: "insensitive" as const } },
        { eventId: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }
  if (appId) filters.push({ applicationId: appId });
  const where = filters.length ? { AND: filters } : {};

  const [events, totalCount, allApplications] = await Promise.all([
    prisma.event.findMany({
      where,
      take: pageSize,
      skip,
      orderBy: { timestamp: "desc" },
      include: { application: true },
    }),
    prisma.event.count({ where }),
    prisma.application.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const showingStart = totalCount === 0 ? 0 : skip + 1;
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
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          <SearchInput placeholder="Search events..." className="w-80" />
          <FilterDropdown
            label="Application"
            paramName="appId"
            options={allApplications.map((a) => ({
              label: a.name,
              value: a.id,
            }))}
          />
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
