'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/auth/sign-out-button';

const navigationSections = [
  {
    label: 'Overview',
    items: [{ name: 'Dashboard', href: '/' }],
  },
  {
    label: 'Analysis',
    items: [
      { name: 'Events', href: '/events' },
      { name: 'Query Explorer', href: '/query' },
      { name: 'Funnels', href: '/funnels' },
      { name: 'Retention', href: '/retention' },
      { name: 'Reports', href: '/reports' },
      { name: 'Segments', href: '/segments' },
      { name: 'Users', href: '/users' },
    ],
  },
  {
    label: 'Data Model',
    items: [
      { name: 'Applications', href: '/applications' },
      { name: 'Schemas', href: '/schemas' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Data Quality', href: '/quality' },
      { name: 'Webhooks', href: '/webhooks' },
    ],
  },
  {
    label: 'Administration',
    items: [{ name: 'Members', href: '/settings/members' }],
  },
];

type SidebarProps = {
  userName: string;
  userEmail: string;
};

export function Sidebar({ userName, userEmail }: SidebarProps) {
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
      <nav className="flex-1 overflow-y-auto px-3 py-6">
        <div className="space-y-6">
          {navigationSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#7A7A7A]">
                {section.label}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
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
                            'h-1.5 w-1.5 rounded-full',
                            isActive ? 'bg-white' : 'bg-[#E8E8E8]',
                          )}
                        />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-[#E8E8E8] px-3 py-4">
        <div className="mb-3 border border-[#E8E8E8] bg-[#FAFAFA] px-3 py-3">
          <p className="truncate text-sm font-medium text-[#0D0D0D]">
            {userName}
          </p>
          <p className="truncate text-xs text-[#7A7A7A]">{userEmail}</p>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
