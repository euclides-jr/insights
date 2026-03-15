import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { ApplicationsHeader } from '@/components/applications-header';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { FilterDropdown } from '@/components/ui/filter-dropdown';
import { Pagination } from '@/components/ui/pagination';
import { prisma } from '@/lib/db/prisma';
import { formatRelativeTime, formatNumber } from '@/lib/format';

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const pageSize = 10;
  const skip = (currentPage - 1) * pageSize;
  const q = params.q?.trim() || '';
  const status = params.status || '';

  const filters: Record<string, unknown>[] = [];
  if (q) filters.push({ name: { contains: q, mode: 'insensitive' as const } });
  if (status) filters.push({ status });
  const where = filters.length ? { AND: filters } : {};

  const [applications, totalCount] = await Promise.all([
    prisma.application.findMany({
      where,
      take: pageSize,
      skip,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { events: true },
        },
        events: {
          take: 1,
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true },
        },
      },
    }),
    prisma.application.count({ where }),
  ]);
  const totalPages = Math.ceil(totalCount / pageSize);
  const showingStart = skip + 1;
  const showingEnd = Math.min(skip + pageSize, totalCount);

  return (
    <DashboardLayout>
      <div className="p-12 space-y-12">
        {/* Header */}
        <ApplicationsHeader />

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          <SearchInput placeholder="Search applications..." className="w-80" />
          <FilterDropdown
            label="Status"
            paramName="status"
            options={[
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Inactive', value: 'INACTIVE' },
            ]}
          />
        </div>

        {/* Applications Table */}
        <div className="space-y-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell
                  width="120px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  App ID
                </TableCell>
                <TableCell
                  width="280px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Application Name
                </TableCell>
                <TableCell
                  width="150px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Events Count
                </TableCell>
                <TableCell
                  width="180px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Last Active
                </TableCell>
                <TableCell
                  width="140px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Status
                </TableCell>
              </TableRow>
            </TableHeader>
            {applications.map((app) => (
              <TableRow key={app.id}>
                <TableCell width="120px">{app.id.slice(0, 12)}</TableCell>
                <TableCell width="280px" className="font-medium">
                  <Link
                    href={`/applications/${app.id}`}
                    className="hover:underline"
                  >
                    {app.name}
                  </Link>
                </TableCell>
                <TableCell width="150px">
                  {formatNumber(app._count.events)}
                </TableCell>
                <TableCell width="180px" className="text-[#7A7A7A]">
                  {app.events[0]
                    ? formatRelativeTime(app.events[0].timestamp)
                    : 'Never'}
                </TableCell>
                <TableCell width="140px">
                  <Badge
                    variant={
                      app.status === 'ACTIVE'
                        ? 'success'
                        : app.status === 'INACTIVE'
                          ? 'neutral'
                          : 'paused'
                    }
                  >
                    {app.status
                      ? app.status.charAt(0) + app.status.slice(1).toLowerCase()
                      : 'Active'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </Table>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            showing={`Showing ${showingStart}-${showingEnd} of ${totalCount} applications`}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
