import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { FunnelResults } from '@/components/funnels/funnel-results';
import { RetentionGrid } from '@/components/retention/retention-grid';
import { Badge } from '@/components/ui/badge';
import { serializeQueryStateToQueryString } from '@/lib/query/hydration';
import {
  getSavedReport,
  normalizeQueryReportConfig,
} from '@/lib/services/report-service';
import { runFunnel } from '@/lib/services/funnel-service';
import { runRetention } from '@/lib/services/retention-service';

function getSourceHref(
  reportType: 'QUERY' | 'FUNNEL' | 'RETENTION',
  config: Record<string, unknown>,
  applicationId?: string | null,
) {
  if (reportType === 'FUNNEL') {
    return '/funnels';
  }
  if (reportType === 'RETENTION') {
    return '/retention';
  }
  const normalized = normalizeQueryReportConfig(config, applicationId);
  const queryString = normalized
    ? serializeQueryStateToQueryString(normalized)
    : '';
  return queryString ? `/query?${queryString}` : '/query';
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getSavedReport(id);

  if (!report) {
    notFound();
  }

  const config = report.config as Record<string, unknown>;
  const preview =
    report.reportType === 'FUNNEL' &&
    typeof config.funnelId === 'string' &&
    config.timeWindow &&
    typeof config.timeWindow === 'object' &&
    'value' in config.timeWindow &&
    'unit' in config.timeWindow
      ? await runFunnel(config.funnelId, {
          timeWindow: {
            value: Number((config.timeWindow as Record<string, unknown>).value),
            unit: (config.timeWindow as Record<string, unknown>).unit as
              | 'days'
              | 'weeks',
          },
        })
      : report.reportType === 'RETENTION'
        ? await runRetention({
            applicationId: report.applicationId ?? '',
            interval:
              config.interval === 'daily' ? 'daily' : 'weekly',
            cohortWindow: {
              value: Number(
                (
                  (config.cohortWindow as Record<string, unknown> | undefined) ??
                  { value: 4 }
                ).value,
              ),
              unit:
                (((config.cohortWindow as Record<string, unknown> | undefined) ??
                  { unit: 'weeks' }).unit as 'days' | 'weeks'),
            },
            returnEventName:
              typeof config.returnEventName === 'string'
                ? config.returnEventName
                : undefined,
          })
        : null;

  return (
    <DashboardLayout>
      <div className="space-y-10 p-12">
        <div className="flex items-start justify-between gap-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
                {report.name}
              </h1>
              <Badge variant="neutral">{report.reportType}</Badge>
            </div>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Saved report configuration and latest preview
            </p>
          </div>
          <Link
            href={getSourceHref(report.reportType, config, report.applicationId)}
            className="border border-[#E8E8E8] bg-white px-4 py-3 text-sm font-medium text-[#0D0D0D]"
          >
            {report.reportType === 'QUERY'
              ? 'Open in Query Explorer'
              : 'Open Source Page'}
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <div className="border border-[#E8E8E8] bg-white px-6 py-6">
            <h2 className="text-xl font-semibold font-[family-name:var(--font-space-grotesk)]">
              Report Config
            </h2>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-sm text-[#0D0D0D]">
              {JSON.stringify(
                {
                  application: report.application?.name ?? null,
                  config,
                },
                null,
                2,
              )}
            </pre>
          </div>

          <div className="border border-[#E8E8E8] bg-white px-6 py-6">
            <h2 className="text-xl font-semibold font-[family-name:var(--font-space-grotesk)]">
              Metadata
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#7A7A7A]">Application</dt>
                <dd>{report.application?.name ?? 'All applications'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#7A7A7A]">Created by</dt>
                <dd>{report.createdBy.name ?? report.createdBy.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#7A7A7A]">Updated by</dt>
                <dd>{report.updatedBy.name ?? report.updatedBy.email}</dd>
              </div>
            </dl>
          </div>
        </div>

        {report.reportType === 'FUNNEL' && Array.isArray(preview) ? (
          <FunnelResults
            title="Saved Funnel Preview"
            description="Latest computed results for this saved funnel report."
            steps={preview}
            testId="saved-funnel-report-preview"
          />
        ) : null}

        {report.reportType === 'RETENTION' && preview && !Array.isArray(preview) ? (
          <RetentionGrid
            result={preview}
            title="Saved Retention Preview"
            description="Latest computed retention output for this saved report."
          />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
