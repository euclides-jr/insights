'use client';

import { Suspense, useCallback, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  placeholder?: string;
  className?: string;
  /** URL param name to sync with. Defaults to "q" */
  paramName?: string;
}

function SearchInputInner({
  placeholder,
  className,
  paramName = 'q',
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get(paramName) ?? '';
  const [value, setValue] = useState(urlValue);
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When the URL param changes externally (back/forward navigation), reset
  // local input value. Using state (not a ref) for the comparison is the
  // React-recommended pattern for "adjusting state when a prop changes".
  if (syncedUrlValue !== urlValue) {
    setSyncedUrlValue(urlValue);
    setValue(urlValue);
  }

  const updateUrl = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) {
        params.set(paramName, query);
      } else {
        params.delete(paramName);
      }
      params.delete('page');
      router.push(pathname + '?' + params.toString());
    },
    [router, pathname, searchParams, paramName],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateUrl(next), 300);
  };

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B0B0]"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
      >
        <path
          d="M7 13C10.3137 13 13 10.3137 13 7C13 3.68629 10.3137 1 7 1C3.68629 1 1 3.68629 1 7C1 10.3137 3.68629 13 7 13Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 15L11.5 11.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          'h-9 pl-9 pr-3 text-sm border border-[#E8E8E8] bg-white text-[#0D0D0D] placeholder:text-[#B0B0B0] focus:outline-none focus:border-[#E42313]',
          className,
        )}
      />
    </div>
  );
}

export function SearchInput(props: SearchInputProps) {
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            'relative h-9 border border-[#E8E8E8] bg-white',
            props.className,
          )}
        />
      }
    >
      <SearchInputInner {...props} />
    </Suspense>
  );
}
