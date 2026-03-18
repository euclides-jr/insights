import { DashboardLayout } from '@/components/dashboard-layout';
import { Table, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { AddFunnelDialog } from '@/components/funnels/add-funnel-dialog';
import { FunnelActions } from '@/components/funnels/funnel-actions';
import { FunnelRunner } from '@/components/funnels/funnel-runner';
import { FunnelResults } from '@/components/funnels/funnel-results';
import { prisma } from '@/lib/db/prisma';
import { formatRelativeTime } from '@/lib/format';
import { runFunnel } from '@/lib/services/funnel-service';

export default async function FunnelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || '';

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { description: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [funnels, applications] = await Promise.all([
    prisma.funnel.findMany({
      where,
      include: {
        steps: {
          orderBy: { position: 'asc' },
        },
        application: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.application.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const previewFunnel = funnels[0] ?? null;
  const previewResults = previewFunnel
    ? await runFunnel(previewFunnel.id, {
        timeWindow: { value: 30, unit: 'days' },
      })
    : [];

  return (
    <DashboardLayout>
      <div className="p-12 space-y-12">
        <div className="flex items-start justify-between gap-8">
          <div>
            <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
              Funnels
            </h1>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Analyze ordered conversion flows across your event stream
            </p>
          </div>
          <div className="max-w-sm border border-[#E8E8E8] bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-[#7A7A7A]">
              Current scope
            </p>
            <p className="mt-2 text-sm text-[#0D0D0D]">
              Funnel APIs are live. Build reusable ordered steps, then run any
              saved funnel against recent event history.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <SearchInput placeholder="Search funnels..." className="w-80" />
          <AddFunnelDialog applications={applications} />
        </div>

        <div className="space-y-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell
                  width="220px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Funnel Name
                </TableCell>
                <TableCell
                  width="180px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Application
                </TableCell>
                <TableCell
                  width="120px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Steps
                </TableCell>
                <TableCell
                  width="180px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Created By
                </TableCell>
                <TableCell
                  width="180px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Updated
                </TableCell>
                <TableCell
                  width="140px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Status
                </TableCell>
                <TableCell
                  width="160px"
                  className="font-medium text-xs text-[#7A7A7A]"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            {funnels.length === 0 ? (
              <TableRow>
                <TableCell width="100%" className="text-[#7A7A7A]">
                  No funnels found.
                </TableCell>
              </TableRow>
            ) : (
              funnels.map((funnel) => (
                <TableRow key={funnel.id}>
                  <TableCell width="220px" className="font-medium">
                    {funnel.name}
                  </TableCell>
                  <TableCell width="180px">{funnel.application.name}</TableCell>
                  <TableCell width="120px">{funnel.steps.length}</TableCell>
                  <TableCell width="180px" className="text-[#7A7A7A]">
                    {funnel.createdBy.name ?? funnel.createdBy.email}
                  </TableCell>
                  <TableCell width="180px" className="text-[#7A7A7A]">
                    {formatRelativeTime(funnel.updatedAt)}
                  </TableCell>
                  <TableCell width="140px">
                    <Badge
                      variant={funnel.steps.length >= 2 ? 'success' : 'neutral'}
                    >
                      {funnel.steps.length >= 2 ? 'Runnable' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell width="160px">
                    <FunnelActions
                      applications={applications}
                      funnel={{
                        id: funnel.id,
                        applicationId: funnel.applicationId,
                        name: funnel.name,
                        description: funnel.description,
                        steps: funnel.steps.map((step) => ({
                          id: step.id,
                          eventName: step.eventName,
                        })),
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </Table>
        </div>

        {funnels.length > 0 ? (
          <div className="space-y-10">
            <FunnelRunner
              funnels={funnels.map((funnel) => ({
                id: funnel.id,
                name: funnel.name,
                applicationId: funnel.applicationId,
              }))}
              initialFunnelId={previewFunnel?.id}
              initialResults={previewResults}
              applications={applications}
            />

            <FunnelResults
              title="30-day Preview"
              description={
                previewFunnel
                  ? `Latest results for ${previewFunnel.name}`
                  : 'Create a funnel to see conversion previews here.'
              }
              steps={previewResults}
              testId="funnel-preview-results"
            />
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
