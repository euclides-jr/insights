import { WorkspaceRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getServerSession } from '@/lib/auth/session';

export class AuthError extends Error {
  status = 401;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  status = 403;

  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

const ROLE_ORDER: Record<WorkspaceRole, number> = {
  [WorkspaceRole.VIEWER]: 1,
  [WorkspaceRole.EDITOR]: 2,
  [WorkspaceRole.ADMIN]: 3,
};

export function isViewer(role: WorkspaceRole | null | undefined) {
  return role === WorkspaceRole.VIEWER;
}

export function isEditor(role: WorkspaceRole | null | undefined) {
  return role === WorkspaceRole.EDITOR;
}

export function isAdmin(role: WorkspaceRole | null | undefined) {
  return role === WorkspaceRole.ADMIN;
}

export async function getCurrentWorkspaceMember() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return null;
  }

  return prisma.workspaceMember.findUnique({
    where: { userId: session.user.id },
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

export async function requireRole(minRole: WorkspaceRole) {
  const membership = await getCurrentWorkspaceMember();

  if (!membership) {
    throw new AuthError();
  }

  if (ROLE_ORDER[membership.role] < ROLE_ORDER[minRole]) {
    throw new ForbiddenError(
      `Requires ${minRole.toLowerCase()} role or higher.`,
    );
  }

  return membership;
}
