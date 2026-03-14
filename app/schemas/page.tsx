import { DashboardLayout } from '@/components/dashboard-layout';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { prisma } from '@/lib/db/prisma';
import { formatRelativeTime } from '@/lib/format';

export default async function SchemasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const pageSize = 10;
  const skip = (currentPage - 1) * pageSize;

  const schemas = await prisma.eventSchema.findMany({
    take: pageSize,
    skip,
    orderBy: { createdAt: 'desc' },
    include: { application: true },
  });

  const totalCount = await prisma.eventSchema.count();
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
              Schemas
            </h1>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Define and manage event schemas for data validation
            </p>
          </div>
          <Button>+ Add Schema</Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          <SearchInput placeholder="Search schemas..." className="w-80" />
          <Button variant="secondary">
            Type
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

        {/* Schemas Table */}
        <div className="space-y-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell
                  width="120px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Schema ID
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
                  Type
                </TableCell>
                <TableCell
                  width="120px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Properties
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
            {schemas.map((schema) => {
              const schemaObj = schema.schemaDefinition as Record<
                string,
                unknown
              >;
              const propertyCount = Object.keys(schemaObj).length;

              return (
                <TableRow key={schema.id}>
                  <TableCell width="120px">{schema.id.slice(0, 12)}</TableCell>
                  <TableCell width="220px" className="font-medium">
                    {schema.eventName}
                  </TableCell>
                  <TableCell width="180px" className="text-[#7A7A7A]">
                    {schema.application.name}
                  </TableCell>
                  <TableCell width="120px">{propertyCount}</TableCell>
                  <TableCell width="180px" className="text-[#7A7A7A]">
                    {formatRelativeTime(schema.createdAt)}
                  </TableCell>
                  <TableCell width="140px">
                    <Badge variant={schema.isActive ? 'success' : 'neutral'}>
                      {schema.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </Table>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            showing={`Showing ${showingStart}-${showingEnd} of ${totalCount} schemas`}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
