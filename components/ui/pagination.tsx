'use client';

import { cn } from '@/lib/utils';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  showing: string;
}

export function Pagination({
  currentPage,
  totalPages,
  showing,
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const navigateToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#7A7A7A]">{showing}</span>
      <div className="flex items-center gap-2">
        <button
          className={cn(
            'w-9 h-9 flex items-center justify-center border border-[#E8E8E8] bg-white text-[#B0B0B0]',
            currentPage === 1 && 'opacity-50 cursor-not-allowed',
          )}
          onClick={() => navigateToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ‹
        </button>
        {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map(
          (page) => (
            <button
              key={page}
              className={cn(
                'w-9 h-9 flex items-center justify-center text-sm font-medium',
                page === currentPage
                  ? 'bg-[#E42313] text-white'
                  : 'border border-[#E8E8E8] bg-white text-[#7A7A7A]',
              )}
              onClick={() => navigateToPage(page)}
            >
              {page}
            </button>
          ),
        )}
        <button
          className={cn(
            'w-9 h-9 flex items-center justify-center border border-[#E8E8E8] bg-white text-[#0D0D0D]',
            currentPage === totalPages && 'opacity-50 cursor-not-allowed',
          )}
          onClick={() => navigateToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          ›
        </button>
      </div>
    </div>
  );
}
