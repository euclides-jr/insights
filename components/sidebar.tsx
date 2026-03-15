'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/' },
  { name: 'Events', href: '/events' },
  { name: 'Query Explorer', href: '/query' },
  { name: 'Applications', href: '/applications' },
  { name: 'Schemas', href: '/schemas' },
  { name: 'Segments', href: '/segments' },
  { name: 'Users', href: '/users' },
  { name: 'Data Quality', href: '/quality' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 h-screen bg-white border-r border-[#E8E8E8] flex flex-col">
      {/* Logo */}
      <div className="h-16 px-6 flex items-center border-b border-[#E8E8E8]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#E42313] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="3" fill="white" />
              <circle cx="7" cy="7" r="6" stroke="white" strokeWidth="1" />
            </svg>
          </div>
          <span className="text-lg font-medium font-[family-name:var(--font-space-grotesk)]">
            EventPulse
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href ||
                  pathname.startsWith(item.href + '/');
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors font-[family-name:var(--font-space-grotesk)]',
                    isActive
                      ? 'bg-[#E42313] text-white'
                      : 'text-[#0D0D0D] hover:bg-[#FAFAFA]',
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      isActive ? 'bg-white' : 'bg-[#E8E8E8]',
                    )}
                  />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
