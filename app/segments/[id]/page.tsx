import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { SegmentDetailClient } from '@/components/segment-detail-client';
import { prisma } from '@/lib/db/prisma';
import { formatRelativeTime, formatNumber } from '@/lib/format';

type Props = { params: Promise<{ id: string }> };

interface EventFilter {
  eventName: string;
  count?: { min?: number; max?: number };
  timeWindow?: { value: number; unit: 'days' | 'hours' };
  properties?: Record<string, unknown>;
}

interface CriteriaShape {
  logic?: 'AND' | 'OR';
  eventFilters?: EventFilter[];
}

export default async function SegmentDetailPage({ params }: Props) {
  const { id } = await params;

  const [segment, applications] = await Promise.all([
    prisma.segment.findUnique({
      where: { id },
      include: { application: { select: { id: true, name: true } } },
    }),
    prisma.application.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!segment) notFound();

  const criteria = segment.criteria as CriteriaShape;
  const filters = criteria.eventFilters ?? [];
  const logic = criteria.logic ?? 'AND';

  // Convert stored criteria filters to the EventFilter shape used by SegmentForm
  const defaultFilters = filters.map((f, idx) => ({
    id: String(idx),
    eventName: f.eventName ?? '',
    countMin: f.count?.min !== undefined ? String(f.count.min) : '',
    countMax: f.count?.max !== undefined ? String(f.count.max) : '',
    timeWindowValue:
      f.timeWindow?.value !== undefined ? String(f.timeWindow.value) : '',
    timeWindowUnit: (f.timeWindow?.unit ?? 'days') as 'days' | 'hours',
    useTimeWindow: !!f.timeWindow,
  }));

  return (
    <DashboardLayout>
      <div className="p-12 space-y-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#7A7A7A]">
          <Link
            href="/segments"
            className="hover:text-[#0D0D0D] transition-colors"
          >
            Segments
          </Link>
          <span>/</span>
          <span className="text-[#0D0D0D] font-medium">{segment.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
                {segment.name}
              </h1>
              <Badge variant={segment.memberCount > 0 ? 'success' : 'neutral'}>
                {segment.memberCount > 0 ? 'Active' : 'Empty'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[#7A7A7A]">
              {segment.application.name} · Last refreshed{' '}
              {formatRelativeTime(segment.lastRefreshedAt)}
            </p>
            {segment.description && (
              <p className="mt-2 text-sm text-[#7A7A7A] max-w-xl">
                {segment.description}
              </p>
            )}
          </div>

          <SegmentDetailClient
            segmentId={segment.id}
            segmentName={segment.name}
            description={segment.description}
            defaultLogic={logic}
            defaultFilters={defaultFilters}
            applicationId={segment.applicationId}
            applications={applications}
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-6">
          <div className="border border-[#E8E8E8] p-6">
            <p className="text-xs text-[#7A7A7A] mb-1">Members</p>
            <p className="text-3xl font-semibold font-[family-name:var(--font-space-grotesk)]">
              {formatNumber(segment.memberCount)}
            </p>
          </div>
          <div className="border border-[#E8E8E8] p-6">
            <p className="text-xs text-[#7A7A7A] mb-1">Filter Logic</p>
            <p className="text-3xl font-semibold font-[family-name:var(--font-space-grotesk)]">
              {logic}
            </p>
          </div>
          <div className="border border-[#E8E8E8] p-6">
            <p className="text-xs text-[#7A7A7A] mb-1">Event Filters</p>
            <p className="text-3xl font-semibold font-[family-name:var(--font-space-grotesk)]">
              {filters.length}
            </p>
          </div>
        </div>

        {/* Criteria detail */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold font-[family-name:var(--font-space-grotesk)]">
            Criteria
          </h2>
          <div className="space-y-3">
            {filters.map((f, idx) => (
              <div key={idx} className="border border-[#E8E8E8] p-5 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[#7A7A7A]">
                    Filter {idx + 1}
                  </span>
                  {idx > 0 && (
                    <Badge variant="neutral" className="text-[10px]">
                      {logic}
                    </Badge>
                  )}
                </div>
                <p className="font-medium">{f.eventName}</p>
                <div className="flex gap-6 text-sm text-[#7A7A7A]">
                  {f.count?.min !== undefined && (
                    <span>Min: {f.count.min} occurrences</span>
                  )}
                  {f.count?.max !== undefined && (
                    <span>Max: {f.count.max} occurrences</span>
                  )}
                  {f.timeWindow && (
                    <span>
                      Within last {f.timeWindow.value} {f.timeWindow.unit}
                    </span>
                  )}
                  {!f.count?.min && !f.count?.max && !f.timeWindow && (
                    <span>Any occurrence</span>
                  )}
                </div>
                {f.properties && Object.keys(f.properties).length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-[#7A7A7A] mb-1">
                      Property filters:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(f.properties).map(([k, v]) => (
                        <span
                          key={k}
                          className="text-xs bg-[#F5F5F5] px-2 py-0.5"
                        >
                          {k} = {String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
