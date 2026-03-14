import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { SchemaDetailClient } from '@/components/schema-detail-client';
import { prisma } from '@/lib/db/prisma';
import { formatRelativeTime } from '@/lib/format';

type Props = { params: Promise<{ id: string }> };

export default async function SchemaDetailPage({ params }: Props) {
  const { id } = await params;

  const [schema, applications] = await Promise.all([
    prisma.eventSchema.findUnique({
      where: { id },
      include: { application: { select: { id: true, name: true } } },
    }),
    prisma.application.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!schema) notFound();

  // All versions of this (applicationId, eventName)
  const allVersions = await prisma.eventSchema.findMany({
    where: { applicationId: schema.applicationId, eventName: schema.eventName },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, isActive: true, createdAt: true },
  });

  // Parse schemaDefinition
  type PropertyDef = {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    description?: string;
  };
  const rawDef = schema.schemaDefinition as {
    properties?: Record<string, PropertyDef>;
  };
  const properties = rawDef.properties ?? {};

  return (
    <DashboardLayout>
      <div className="p-12 space-y-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#7A7A7A]">
          <Link
            href="/schemas"
            className="hover:text-[#0D0D0D] transition-colors"
          >
            Schemas
          </Link>
          <span>/</span>
          <span className="text-[#0D0D0D] font-medium">{schema.eventName}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
                {schema.eventName}
              </h1>
              <Badge variant={schema.isActive ? 'success' : 'neutral'}>
                {schema.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[#7A7A7A]">
              {schema.application.name} · Version {schema.version} ·{' '}
              {formatRelativeTime(schema.createdAt)}
            </p>
          </div>

          {/* Edit / deactivate actions (client) */}
          <SchemaDetailClient
            schemaId={schema.id}
            isActive={schema.isActive}
            applications={applications}
            defaultProperties={Object.entries(properties).map(([key, def]) => ({
              id: key,
              key,
              type: def.type,
              required: def.required ?? false,
              description: def.description ?? '',
            }))}
          />
        </div>

        {/* Properties table */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
            Properties ({Object.keys(properties).length})
          </h2>
          <div className="bg-white border border-[#E8E8E8] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E8E8] bg-[#FAFAFA]">
                  {['Property', 'Type', 'Required', 'Description'].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-medium text-[#7A7A7A]"
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {Object.entries(properties).length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-[#7A7A7A] text-sm"
                    >
                      No properties defined
                    </td>
                  </tr>
                ) : (
                  Object.entries(properties).map(([key, def]) => (
                    <tr
                      key={key}
                      className="border-b border-[#E8E8E8] last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium">
                        {key}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral">{def.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[#7A7A7A]">
                        {def.required ? (
                          <span className="text-[#E42313] font-medium">
                            Yes
                          </span>
                        ) : (
                          'No'
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#7A7A7A]">
                        {def.description ?? '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Version history */}
        {allVersions.length > 1 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-[#0D0D0D] font-(family-name:--font-space-grotesk)">
              Version History
            </h2>
            <div className="flex flex-col gap-2">
              {allVersions.map((v) => (
                <Link
                  key={v.id}
                  href={`/schemas/${v.id}`}
                  className={`flex items-center gap-4 px-4 py-3 border text-sm transition-colors ${
                    v.id === schema.id
                      ? 'border-[#0D0D0D] bg-[#FAFAFA]'
                      : 'border-[#E8E8E8] bg-white hover:bg-[#FAFAFA]'
                  }`}
                >
                  <span className="font-medium min-w-[60px]">v{v.version}</span>
                  <Badge variant={v.isActive ? 'success' : 'neutral'}>
                    {v.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="text-[#7A7A7A] text-xs">
                    {formatRelativeTime(v.createdAt)}
                  </span>
                  {v.id === schema.id && (
                    <span className="ml-auto text-xs text-[#7A7A7A]">
                      Currently viewing
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
