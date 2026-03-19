import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { InviteMemberDialog } from '@/components/settings/invite-member-dialog';
import { MemberTable } from '@/components/settings/member-table';
import { prisma } from '@/lib/db/prisma';
import {
  AuthError,
  ForbiddenError,
  getCurrentWorkspaceMember,
  requireRole,
} from '@/lib/auth/roles';
import { WorkspaceRole } from '@prisma/client';

export default async function MembersSettingsPage() {
  try {
    await requireRole(WorkspaceRole.ADMIN);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/sign-in');
    }

    if (error instanceof ForbiddenError) {
      redirect('/');
    }

    throw error;
  }

  const currentMember = await getCurrentWorkspaceMember();

  if (!currentMember) {
    redirect('/sign-in');
  }

  const [members, invitations] = await Promise.all([
    prisma.workspaceMember.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.invitation.findMany({
      where: {
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <DashboardLayout>
      <div className="space-y-10 p-12">
        <div className="flex items-start justify-between gap-8">
          <div>
            <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
              Members
            </h1>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Invite teammates and manage workspace roles
            </p>
          </div>
          <InviteMemberDialog />
        </div>

        <MemberTable
          members={members.map((member) => ({
            userId: member.userId,
            email: member.user.email,
            name: member.user.name,
            role: member.role,
            createdAt: member.createdAt,
            updatedAt: member.updatedAt,
          }))}
          invitations={invitations.map((invitation) => ({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
          }))}
          currentUserId={currentMember.userId}
        />
      </div>
    </DashboardLayout>
  );
}
