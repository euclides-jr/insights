import { DashboardLayout } from '@/components/dashboard-layout';
import { QueryForm } from '@/components/query-form';
import { prisma } from '@/lib/db/prisma';

export default async function QueryPage() {
  const applications = await prisma.application.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, apiKey: true },
  });

  return (
    <DashboardLayout>
      <div className="p-12 space-y-12">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[40px] font-semibold font-(family-name:--font-space-grotesk) tracking-tight">
              Query Explorer
            </h1>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Filter and aggregate event data across your applications
            </p>
          </div>
        </div>

        {applications.length === 0 ? (
          <div className="bg-white border border-[#E8E8E8] px-8 py-16 text-center text-sm text-[#7A7A7A]">
            No applications found. Create an application first to run queries.
          </div>
        ) : (
          <QueryForm applications={applications} />
        )}
      </div>
    </DashboardLayout>
  );
}
