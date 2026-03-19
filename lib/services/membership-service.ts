import { createHash, randomBytes } from 'crypto';
import type {
  Invitation,
  WorkspaceRole,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export class MembershipError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'MembershipError';
    this.status = status;
  }
}

export type CreateInvitationInput = {
  email: string;
  role: WorkspaceRole;
  expiresInDays?: number;
};

function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createInvitationToken() {
  return randomBytes(24).toString('hex');
}

export function getInvitationUrl(token: string) {
  const baseUrl =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';

  return `${baseUrl}/accept-invitation?token=${token}`;
}

async function ensureActorIsAdmin(actorUserId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId: actorUserId },
  });

  if (!membership || membership.role !== 'ADMIN') {
    throw new MembershipError('Admin role required', 403);
  }

  return membership;
}

async function ensureNotLastAdmin(targetUserId: string, nextRole?: WorkspaceRole) {
  const current = await prisma.workspaceMember.findUnique({
    where: { userId: targetUserId },
  });

  if (!current || current.role !== 'ADMIN') {
    return;
  }

  if (nextRole === 'ADMIN') {
    return;
  }

  const adminCount = await prisma.workspaceMember.count({
    where: { role: 'ADMIN' },
  });

  if (adminCount <= 1) {
    throw new MembershipError('Cannot modify the last remaining admin', 409);
  }
}

export async function listWorkspaceMembers() {
  return prisma.workspaceMember.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      invitedBy: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: [
      { role: 'desc' },
      { createdAt: 'asc' },
    ],
  });
}

export async function createInvitation(
  actorUserId: string,
  input: CreateInvitationInput,
): Promise<Invitation & { inviteUrl: string }> {
  await ensureActorIsAdmin(actorUserId);

  const normalizedEmail = input.email.trim().toLowerCase();
  const existingMember = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      workspaceMembership: {
        select: {
          role: true,
        },
      },
    },
  });

  if (existingMember?.workspaceMembership) {
    throw new MembershipError('User is already a workspace member', 409);
  }

  const activeInvite = await prisma.invitation.findFirst({
    where: {
      email: normalizedEmail,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (activeInvite) {
    throw new MembershipError('An active invitation already exists for this email', 409);
  }

  const token = createInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 7));

  const invitation = await prisma.invitation.create({
    data: {
      email: normalizedEmail,
      role: input.role,
      token,
      tokenHash,
      invitedByUserId: actorUserId,
      expiresAt,
    },
  });

  return {
    ...invitation,
    inviteUrl: getInvitationUrl(token),
  };
}

export async function getInvitationPreview(token: string) {
  return prisma.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      invitedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function acceptInvitation(
  token: string,
  userId: string,
  email: string,
) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
  });

  if (!invitation) {
    throw new MembershipError('Invitation not found', 404);
  }

  if (invitation.acceptedAt) {
    throw new MembershipError('Invitation has already been accepted', 409);
  }

  if (invitation.expiresAt <= new Date()) {
    throw new MembershipError('Invitation has expired', 409);
  }

  if (invitation.email.toLowerCase() !== email.trim().toLowerCase()) {
    throw new MembershipError('Invitation email does not match the signed-in user', 409);
  }

  const existingMembership = await prisma.workspaceMember.findUnique({
    where: { userId },
  });

  if (existingMembership) {
    throw new MembershipError('User is already a workspace member', 409);
  }

  const [, membership] = await prisma.$transaction([
    prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: new Date(),
        acceptedByUserId: userId,
      },
    }),
    prisma.workspaceMember.create({
      data: {
        userId,
        role: invitation.role,
        invitedByUserId: invitation.invitedByUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return membership;
}

export async function revokeInvitation(
  invitationId: string,
  actorUserId: string,
) {
  await ensureActorIsAdmin(actorUserId);

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new MembershipError('Invitation not found', 404);
  }

  if (invitation.acceptedAt) {
    throw new MembershipError('Accepted invitations cannot be revoked', 409);
  }

  return prisma.invitation.delete({
    where: { id: invitationId },
  });
}

export async function updateWorkspaceMemberRole(
  targetUserId: string,
  role: WorkspaceRole,
  actorUserId: string,
) {
  await ensureActorIsAdmin(actorUserId);

  if (targetUserId === actorUserId) {
    throw new MembershipError('You cannot change your own role', 409);
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId: targetUserId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!membership) {
    throw new MembershipError('Member not found', 404);
  }

  await ensureNotLastAdmin(targetUserId, role);

  return prisma.workspaceMember.update({
    where: { userId: targetUserId },
    data: { role },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
}

export async function removeWorkspaceMember(
  targetUserId: string,
  actorUserId: string,
) {
  await ensureActorIsAdmin(actorUserId);

  if (targetUserId === actorUserId) {
    throw new MembershipError('You cannot remove yourself', 409);
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId: targetUserId },
  });

  if (!membership) {
    throw new MembershipError('Member not found', 404);
  }

  await ensureNotLastAdmin(targetUserId);

  return prisma.workspaceMember.delete({
    where: { userId: targetUserId },
  });
}

export const membershipTestUtils = {
  createInvitationToken,
  hashInvitationToken,
};
