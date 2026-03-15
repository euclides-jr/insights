import { Suspense } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { UsersPageClient } from '@/components/forms/UsersPageClient';
import { prisma } from '@/lib/db/prisma';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  // Load applications for API key selection
  const applications = await prisma.application.findMany({
    select: { id: true, name: true, apiKey: true },
    orderBy: { name: 'asc' },
  });

  return (
    <DashboardLayout>
      <div className="p-12 space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
            Users
          </h1>
          <p className="mt-2 text-sm text-[#7A7A7A]">
            Browse, filter, and query user attribute profiles
          </p>
        </div>

        <Suspense fallback={<div className="text-sm text-[#7A7A7A]">Loading…</div>}>
          <UsersPageClient applications={applications} searchParams={params} />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
