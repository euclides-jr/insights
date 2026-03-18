import { Sidebar } from '@/components/sidebar';
import { getServerSession } from '@/lib/auth/session';

export async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  return (
    <div className="flex h-screen bg-[#FAFAFA]">
      <Sidebar
        userName={session?.user.name ?? 'Authenticated User'}
        userEmail={session?.user.email ?? 'session@eventpulse.local'}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
