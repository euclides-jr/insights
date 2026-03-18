import { DashboardLayout } from '@/components/dashboard-layout';
import { RetentionRunner } from '@/components/retention/retention-runner';
import { prisma } from '@/lib/db/prisma';
import { runRetention } from '@/lib/services/retention-service';

export default async function RetentionPage() {
  const applications = await prisma.application.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const initialResult = applications[0]
    ? await runRetention({
        applicationId: applications[0].id,
        interval: 'weekly',
        cohortWindow: {
          value: 4,
          unit: 'weeks',
        },
      })
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-10 p-12">
        <div className="flex items-start justify-between gap-8">
          <div>
            <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
              Retention
            </h1>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Measure how often users return after their first observed activity
            </p>
          </div>
          <div className="max-w-sm border border-[#E8E8E8] bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-[#7A7A7A]">
              Cohort model
            </p>
            <p className="mt-2 text-sm text-[#0D0D0D]">
              Users are grouped by their first event inside the selected window,
              then tracked across daily or weekly return buckets.
            </p>
          </div>
        </div>

        <RetentionRunner applications={applications} initialResult={initialResult} />
      </div>
    </DashboardLayout>
  );
}
