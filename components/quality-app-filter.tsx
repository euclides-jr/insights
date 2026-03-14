'use client';

import { useRouter } from 'next/navigation';

interface Application {
  id: string;
  name: string;
}

interface QualityAppFilterProps {
  applications: Application[];
  selectedId: string;
  days: number;
}

export function QualityAppFilter({
  applications,
  selectedId,
  days,
}: QualityAppFilterProps) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sp = new URLSearchParams();
    if (e.target.value) sp.set('applicationId', e.target.value);
    sp.set('days', String(days));
    sp.set('page', '1');
    router.push(`/quality?${sp.toString()}`);
  }

  return (
    <select
      value={selectedId}
      onChange={handleChange}
      className="h-9 px-3 border border-[#E8E8E8] bg-white text-sm focus:outline-none focus:border-[#0D0D0D] transition-colors"
    >
      <option value="">All Applications</option>
      {applications.map((app) => (
        <option key={app.id} value={app.id}>
          {app.name}
        </option>
      ))}
    </select>
  );
}
