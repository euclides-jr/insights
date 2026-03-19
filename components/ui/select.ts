import { cn } from '@/lib/utils';

export const selectInputClass = cn(
  'h-10 w-full appearance-none rounded-md border border-[#E8E8E8] bg-white',
  'px-3 py-2 pr-10 text-sm',
  'focus:outline-none focus:ring-2 focus:ring-[#0A0A0A] focus:ring-offset-0',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

export const selectInputSquareClass = cn(
  selectInputClass,
  'rounded-none',
);

export const selectChevronStyle = {
  backgroundImage:
    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'none\'%3E%3Cpath d=\'M6 8l4 4 4-4\' stroke=\'%236C6C6C\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
  backgroundPosition: 'right 0.75rem center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '16px 16px',
} as const;
