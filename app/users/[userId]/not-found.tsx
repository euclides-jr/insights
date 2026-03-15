import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';

export default function UserNotFound() {
  return (
    <DashboardLayout>
      <div className="p-12 space-y-6">
        <nav className="flex items-center gap-2 text-sm text-[#7A7A7A]">
          <Link
            href="/users"
            className="hover:text-[#0A0A0A] transition-colors"
          >
            Users
          </Link>
          <span>/</span>
          <span className="text-[#0A0A0A]">Not found</span>
        </nav>
        <div className="space-y-2">
          <h1 className="text-[32px] font-semibold font-mono tracking-tight">
            User not found
          </h1>
          <p className="text-sm text-[#7A7A7A]">
            No user profile exists with that ID.
          </p>
          <Link
            href="/users"
            className="inline-block mt-4 text-sm text-[#E42313] hover:underline"
          >
            ← Back to Users
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
