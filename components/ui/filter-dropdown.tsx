'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterDropdownProps {
  label: string;
  paramName: string;
  options: FilterOption[];
  className?: string;
}

function FilterDropdownInner({
  label,
  paramName,
  options,
  className,
}: FilterDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = searchParams.get(paramName);
  const currentLabel = options.find((o) => o.value === current)?.label;

  const select = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(paramName, value);
    } else {
      params.delete(paramName);
    }
    params.delete('page');
    router.push(pathname + '?' + params.toString());
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 h-9 px-3 border text-sm transition-colors',
          current
            ? 'border-[#E42313] bg-[#FFF5F4] text-[#E42313]'
            : 'border-[#E8E8E8] bg-white text-[#0D0D0D] hover:bg-[#FAFAFA]',
        )}
      >
        {currentLabel ? (
          <>
            <span className="text-[#7A7A7A] font-normal">{label}:</span>
            <span className="font-medium">{currentLabel}</span>
          </>
        ) : (
          label
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          className={cn('transition-transform', open && 'rotate-180')}
        >
          <path d="M3 5L6 8L9 5H3Z" />
        </svg>
      </button>

      {open && (
        <>
          {/* backdrop to close on outside click */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 min-w-[160px] border border-[#E8E8E8] bg-white shadow-sm">
            {current && (
              <button
                onClick={() => select(null)}
                className="w-full text-left px-3 py-2 text-sm text-[#7A7A7A] hover:bg-[#FAFAFA] border-b border-[#E8E8E8]"
              >
                Clear filter
              </button>
            )}
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => select(opt.value)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-[#FAFAFA] transition-colors',
                  current === opt.value
                    ? 'text-[#E42313] font-medium'
                    : 'text-[#0D0D0D]',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function FilterDropdown(props: FilterDropdownProps) {
  return (
    <Suspense
      fallback={<div className="h-9 w-28 border border-[#E8E8E8] bg-white" />}
    >
      <FilterDropdownInner {...props} />
    </Suspense>
  );
}
