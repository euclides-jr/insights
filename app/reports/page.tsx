import { DashboardLayout } from '@/components/dashboard-layout';
import { AddReportDialog } from '@/components/reports/add-report-dialog';
import { ReportActions } from '@/components/reports/report-actions';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Table, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { prisma } from '@/lib/db/prisma';
import { formatRelativeTime } from '@/lib/format';
import { listSavedReports } from '@/lib/services/report-service';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ reportType?: string }>;
}) {
  const params = await searchParams;
  const reportType =
    params.reportType === 'QUERY' ||
    params.reportType === 'FUNNEL' ||
    params.reportType === 'RETENTION'
      ? params.reportType
      : undefined;

  const [reports, applications] = await Promise.all([
    listSavedReports(reportType),
    prisma.application.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <DashboardLayout>
      <div className="space-y-12 p-12">
        <div className="flex items-start justify-between gap-8">
          <div>
            <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
              Reports
            </h1>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Save reusable analytics views and reopen them without rebuilding filters
            </p>
          </div>
          <AddReportDialog applications={applications} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <SearchInput
            placeholder="Filter by report type via ?reportType=FUNNEL"
            className="w-[360px]"
          />
          <div className="border border-[#E8E8E8] bg-white px-4 py-3 text-sm text-[#7A7A7A]">
            Current filter: <span className="font-medium text-[#0D0D0D]">{reportType ?? 'All types'}</span>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableCell width="240px" className="font-medium text-xs text-[#7A7A7A]">
                Report
              </TableCell>
              <TableCell width="140px" className="font-medium text-xs text-[#7A7A7A]">
                Type
              </TableCell>
              <TableCell width="180px" className="font-medium text-xs text-[#7A7A7A]">
                Application
              </TableCell>
              <TableCell width="180px" className="font-medium text-xs text-[#7A7A7A]">
                Updated
              </TableCell>
              <TableCell width="180px" className="font-medium text-xs text-[#7A7A7A]">
                Updated By
              </TableCell>
              <TableCell width="180px" className="font-medium text-xs text-[#7A7A7A]">
                Config
              </TableCell>
              <TableCell width="160px" className="font-medium text-xs text-[#7A7A7A]">
                Actions
              </TableCell>
            </TableRow>
          </TableHeader>

          {reports.length === 0 ? (
            <TableRow>
              <TableCell width="100%" className="text-[#7A7A7A]">
                No saved reports found.
              </TableCell>
            </TableRow>
          ) : (
            reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell width="240px" className="font-medium">
                  {report.name}
                </TableCell>
                <TableCell width="140px">
                  <Badge variant="neutral">{report.reportType}</Badge>
                </TableCell>
                <TableCell width="180px">
                  {report.application?.name ?? 'All applications'}
                </TableCell>
                <TableCell width="180px" className="text-[#7A7A7A]">
                  {formatRelativeTime(report.updatedAt)}
                </TableCell>
                <TableCell width="180px" className="text-[#7A7A7A]">
                  {report.updatedBy.name ?? report.updatedBy.email}
                </TableCell>
                <TableCell width="180px" className="text-[#7A7A7A]">
                  <code className="text-xs">
                    {JSON.stringify(report.config).slice(0, 48)}
                  </code>
                </TableCell>
                <TableCell width="160px">
                  <ReportActions
                    applications={applications}
                    report={{
                      id: report.id,
                      name: report.name,
                      reportType: report.reportType,
                      applicationId: report.applicationId,
                      config: report.config as Record<string, unknown>,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </Table>
      </div>
    </DashboardLayout>
  );
}
