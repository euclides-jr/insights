'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { selectChevronStyle, selectInputClass } from '@/components/ui/select';

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
      className={cn(selectInputClass, 'h-9 rounded-none py-1')}
      style={selectChevronStyle}
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
