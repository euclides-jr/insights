import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { AddSegmentDialog } from '@/components/add-segment-dialog';
import { prisma } from '@/lib/db/prisma';
import { formatRelativeTime, formatNumber } from '@/lib/format';

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const pageSize = 10;
  const skip = (currentPage - 1) * pageSize;

  const segments = await prisma.segment.findMany({
    take: pageSize,
    skip,
    orderBy: { updatedAt: 'desc' },
    include: { application: true },
  });

  const applications = await prisma.application.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const totalCount = await prisma.segment.count();
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
              Segments
            </h1>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Create and manage user segments
            </p>
          </div>
          <AddSegmentDialog applications={applications} />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          <SearchInput placeholder="Search segments..." className="w-80" />
        </div>

        {/* Segments Table */}
        <div className="space-y-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell
                  width="120px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Segment ID
                </TableCell>
                <TableCell
                  width="220px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Name
                </TableCell>
                <TableCell
                  width="180px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Conditions
                </TableCell>
                <TableCell
                  width="120px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Users
                </TableCell>
                <TableCell
                  width="180px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Last Updated
                </TableCell>
                <TableCell
                  width="140px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Status
                </TableCell>
              </TableRow>
            </TableHeader>
            {segments.map((segment) => {
              const criteriaObj = segment.criteria as Record<string, unknown>;
              const criteriaDisplay =
                segment.description || JSON.stringify(criteriaObj).slice(0, 50);

              return (
                <TableRow key={segment.id}>
                  <TableCell width="120px">
                    <Link
                      href={`/segments/${segment.id}`}
                      className="text-[#0D0D0D] hover:underline"
                    >
                      {segment.id.slice(0, 12)}
                    </Link>
                  </TableCell>
                  <TableCell width="220px" className="font-medium">
                    <Link
                      href={`/segments/${segment.id}`}
                      className="hover:underline"
                    >
                      {segment.name}
                    </Link>
                  </TableCell>
                  <TableCell width="180px" className="text-[#7A7A7A]">
                    {criteriaDisplay}
                  </TableCell>
                  <TableCell width="120px">
                    {formatNumber(segment.memberCount)}
                  </TableCell>
                  <TableCell width="180px" className="text-[#7A7A7A]">
                    {formatRelativeTime(segment.lastRefreshedAt)}
                  </TableCell>
                  <TableCell width="140px">
                    <Badge
                      variant={segment.memberCount > 0 ? 'success' : 'neutral'}
                    >
                      {segment.memberCount > 0 ? 'Active' : 'Empty'}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </Table>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            showing={`Showing ${showingStart}-${showingEnd} of ${totalCount} segments`}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
