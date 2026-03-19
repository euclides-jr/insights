import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { InviteMemberDialog } from '@/components/settings/invite-member-dialog';
import { MemberTable } from '@/components/settings/member-table';
import { prisma } from '@/lib/db/prisma';
import {
  AuthError,
  getCurrentWorkspaceMember,
  hasRequiredRole,
} from '@/lib/auth/roles';
import { getInvitationUrl } from '@/lib/services/membership-service';
import { WorkspaceRole } from '@prisma/client';

export default async function MembersSettingsPage() {
  let currentMember;
  try {
    currentMember = await getCurrentWorkspaceMember();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/sign-in');
    }

    throw error;
  }

  if (!currentMember) {
    redirect('/sign-in');
  }

  if (!hasRequiredRole(currentMember.role, WorkspaceRole.ADMIN)) {
    return (
      <DashboardLayout>
        <div className="space-y-10 p-12">
          <div>
            <h1 className="text-[40px] font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
              Members
            </h1>
            <p className="mt-2 text-sm text-[#7A7A7A]">
              Invite teammates and manage workspace roles
            </p>
          </div>

          <div className="max-w-3xl border border-[#E8E8E8] bg-white p-8 space-y-4">
            <h2 className="text-2xl font-semibold font-[family-name:var(--font-space-grotesk)] tracking-tight">
              Higher role required
            </h2>
            <p className="text-sm text-[#4F4F4F]">
              Access to this page requires an admin role. Your current role is{' '}
              <span className="font-medium">
                {currentMember.role.toLowerCase()}
              </span>
              .
            </p>
            <p className="text-sm text-[#7A7A7A]">
              Ask a workspace admin to grant additional access if you need to
              manage members or invitations.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
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
            inviteUrl: invitation.token ? getInvitationUrl(invitation.token) : null,
          }))}
          currentUserId={currentMember.userId}
        />
      </div>
    </DashboardLayout>
  );
}
