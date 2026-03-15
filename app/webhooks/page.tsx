import { DashboardLayout } from '@/components/dashboard-layout';
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AddWebhookButton } from '@/components/webhook-dialog';
import { WebhookActions, StatusCell } from './client';
import { prisma } from '@/lib/db/prisma';
import { formatRelativeTime } from '@/lib/format';

export default async function WebhooksPage() {
  const [webhooks, applications] = await Promise.all([
    prisma.webhookAlert.findMany({
      orderBy: { createdAt: 'desc' },
      include: { application: { select: { id: true, name: true } } },
    }),
    prisma.application.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Redact secrets — never send raw secrets to the client
  const safeWebhooks = webhooks.map((wh) => ({
    ...wh,
    secret: wh.secret ? '••••••••' : null,
    lastTriggeredAt: wh.lastTriggeredAt?.toISOString() ?? null,
    createdAt: wh.createdAt.toISOString(),
    updatedAt: wh.updatedAt.toISOString(),
  }));

  return (
    <DashboardLayout>
      <div className="p-12 space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
              Webhooks
            </h1>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Get notified at a URL when data quality thresholds are breached
            </p>
          </div>
          <AddWebhookButton applications={applications} />
        </div>

        {/* How it works */}
        <div className="border border-[#E8E8E8] bg-[#FAFAFA] px-5 py-4 space-y-1.5 text-sm">
          <p className="font-medium text-[#0D0D0D]">How it works</p>
          <ul className="list-disc list-inside space-y-1 text-[#7A7A7A]">
            <li>
              EventPulse posts a signed JSON payload to your endpoint when
              validation failures, completeness, or duplicate rate thresholds
              are breached.
            </li>
            <li>
              Optionally set a{' '}
              <strong className="text-[#0D0D0D]">signing secret</strong> and
              verify the{' '}
              <code className="text-xs bg-[#E8E8E8] px-1">
                X-Webhook-Signature
              </code>{' '}
              header (HMAC-SHA256) on your server.
            </li>
            <li>
              Use the <strong className="text-[#0D0D0D]">Test</strong> button to
              send a synthetic error-level payload immediately.
            </li>
          </ul>
        </div>

        {/* Table */}
        {webhooks.length === 0 ? (
          <div className="border border-dashed border-[#E8E8E8] py-20 text-center space-y-3">
            <p className="text-sm text-[#7A7A7A]">
              No webhooks configured yet.
            </p>
            <AddWebhookButton applications={applications} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell
                  width="200px"
                  className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
                >
                  Name
                </TableCell>
                <TableCell
                  width="160px"
                  className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
                >
                  Application
                </TableCell>
                <TableCell
                  width="280px"
                  className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
                >
                  Endpoint URL
                </TableCell>
                <TableCell
                  width="120px"
                  className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
                >
                  Trigger level
                </TableCell>
                <TableCell
                  width="100px"
                  className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
                >
                  Status
                </TableCell>
                <TableCell
                  width="160px"
                  className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide"
                >
                  Last delivery
                </TableCell>
                <TableCell className="text-xs font-semibold text-[#7A7A7A] uppercase tracking-wide">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            {safeWebhooks.map((wh) => (
              <TableRow key={wh.id}>
                <TableCell width="200px" className="font-medium">
                  <div className="space-y-0.5">
                    <p>{wh.name}</p>
                    {wh.secret && (
                      <p className="text-xs text-[#7A7A7A]">Signed ✓</p>
                    )}
                  </div>
                </TableCell>
                <TableCell width="160px" className="text-sm text-[#7A7A7A]">
                  {wh.application.name}
                </TableCell>
                <TableCell width="280px">
                  <code className="text-xs text-[#3A3A3A] break-all">
                    {wh.url}
                  </code>
                </TableCell>
                <TableCell width="120px">
                  <Badge
                    variant={wh.minLevel === 'warning' ? 'warning' : 'error'}
                  >
                    {wh.minLevel === 'warning' ? '≥ Warning' : 'Error only'}
                  </Badge>
                </TableCell>
                <TableCell width="100px">
                  <Badge variant={wh.isActive ? 'success' : 'neutral'}>
                    {wh.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell width="160px" className="text-sm text-[#7A7A7A]">
                  {wh.lastTriggeredAt ? (
                    <div className="space-y-0.5">
                      <StatusCell
                        lastStatus={wh.lastStatus}
                        lastTriggeredAt={wh.lastTriggeredAt}
                      />
                      <p className="text-xs text-[#7A7A7A]">
                        {formatRelativeTime(new Date(wh.lastTriggeredAt))}
                      </p>
                    </div>
                  ) : (
                    <span className="text-[#7A7A7A]">Never</span>
                  )}
                </TableCell>
                <TableCell>
                  <WebhookActions webhook={wh} applications={applications} />
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>
    </DashboardLayout>
  );
}
