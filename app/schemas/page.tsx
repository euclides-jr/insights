import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Pagination } from '@/components/ui/pagination';
import { AddSchemaDialog } from '@/components/add-schema-dialog';
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

  const [schemas, totalCount, applications] = await Promise.all([
    prisma.eventSchema.findMany({
      take: pageSize,
      skip,
      orderBy: { createdAt: 'desc' },
      include: { application: { select: { id: true, name: true } } },
    }),
    prisma.eventSchema.count(),
    prisma.application.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
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
              Schemas
            </h1>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Define and manage event schemas for data validation
            </p>
          </div>
          <AddSchemaDialog applications={applications} />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          <SearchInput placeholder="Search schemas..." className="w-80" />
          <button className="flex items-center gap-1 h-9 px-3 border border-[#E8E8E8] bg-white text-sm text-[#0D0D0D] hover:bg-[#FAFAFA] transition-colors">
            Type
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 5L6 8L9 5H3Z" />
            </svg>
          </button>
          <button className="flex items-center gap-1 h-9 px-3 border border-[#E8E8E8] bg-white text-sm text-[#0D0D0D] hover:bg-[#FAFAFA] transition-colors">
            Status
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 5L6 8L9 5H3Z" />
            </svg>
          </button>
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
              const schemaObj = schema.schemaDefinition as {
                properties?: Record<string, unknown>;
              };
              const propertyCount = Object.keys(
                schemaObj.properties ?? {},
              ).length;

              return (
                <TableRow
                  key={schema.id}
                  className="hover:bg-[#FAFAFA] transition-colors"
                >
                  <TableCell width="120px">
                    <Link
                      href={`/schemas/${schema.id}`}
                      className="font-mono text-xs text-[#7A7A7A] hover:text-[#0D0D0D] transition-colors"
                    >
                      {schema.id.slice(0, 12)}
                    </Link>
                  </TableCell>
                  <TableCell width="220px" className="font-medium">
                    <Link
                      href={`/schemas/${schema.id}`}
                      className="hover:text-[#E42313] transition-colors"
                    >
                      {schema.eventName}
                      {schema.version > 1 && (
                        <span className="ml-1.5 text-xs text-[#7A7A7A] font-normal">
                          v{schema.version}
                        </span>
                      )}
                    </Link>
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
