import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceRole } from '@prisma/client';

vi.mock('@/lib/auth/roles', () => {
  class AuthError extends Error {
    status = 401;
    constructor(message = 'Authentication required') {
      super(message);
      this.name = 'AuthError';
    }
  }

  class ForbiddenError extends Error {
    status = 403;
    constructor(message = 'Forbidden') {
      super(message);
      this.name = 'ForbiddenError';
    }
  }

  return {
    AuthError,
    ForbiddenError,
    requireRole: vi.fn(),
  };
});

vi.mock('@/lib/auth/session', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/services/membership-service', () => ({
  MembershipError: class MembershipError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.name = 'MembershipError';
      this.status = status;
    }
  },
  createInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  listWorkspaceMembers: vi.fn(),
  updateWorkspaceMemberRole: vi.fn(),
  removeWorkspaceMember: vi.fn(),
}));

import { AuthError, ForbiddenError, requireRole } from '@/lib/auth/roles';
import { getServerSession } from '@/lib/auth/session';
import {
  acceptInvitation,
  createInvitation,
  listWorkspaceMembers,
  MembershipError,
  removeWorkspaceMember,
  revokeInvitation,
  updateWorkspaceMemberRole,
} from '@/lib/services/membership-service';
import { POST as createInvitationRoute } from '@/app/api/invitations/route';
import { POST as acceptInvitationRoute } from '@/app/api/invitations/accept/route';
import { POST as revokeInvitationRoute } from '@/app/api/invitations/[id]/revoke/route';
import { GET as listMembersRoute } from '@/app/api/members/route';
import {
  DELETE as deleteMemberRoute,
  PATCH as updateMemberRoute,
} from '@/app/api/members/[userId]/route';

const adminMembership = {
  id: 'member-1',
  userId: 'admin-1',
  role: WorkspaceRole.ADMIN,
};

describe('membership api routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates an invitation for admins', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(adminMembership as never);
    vi.mocked(createInvitation).mockResolvedValueOnce({
      id: 'invite-1',
      email: 'viewer@example.com',
      role: 'VIEWER',
      expiresAt: new Date('2026-03-25T00:00:00.000Z'),
      inviteUrl: 'http://localhost:3000/settings/members?inviteToken=abc',
      createdAt: new Date('2026-03-18T00:00:00.000Z'),
    } as never);

    const response = await createInvitationRoute(
      new NextRequest('http://localhost:3000/api/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: 'viewer@example.com',
          role: 'VIEWER',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: 'invite-1',
      email: 'viewer@example.com',
    });
  });

  it('accepts invitations for signed-in users', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: 'user-2', email: 'viewer@example.com' },
    } as never);
    vi.mocked(acceptInvitation).mockResolvedValueOnce({
      userId: 'user-2',
      role: 'VIEWER',
    } as never);

    const response = await acceptInvitationRoute(
      new NextRequest('http://localhost:3000/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'abc' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      membership: { userId: 'user-2', role: 'VIEWER' },
    });
  });

  it('lists members for admins', async () => {
    vi.mocked(requireRole).mockResolvedValueOnce(adminMembership as never);
    vi.mocked(listWorkspaceMembers).mockResolvedValueOnce([
      {
        userId: 'admin-1',
        role: 'ADMIN',
        user: { email: 'admin@example.com', name: 'Admin' },
        createdAt: new Date('2026-03-18T00:00:00.000Z'),
        updatedAt: new Date('2026-03-18T00:00:00.000Z'),
      },
    ] as never);

    const response = await listMembersRoute();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      members: [{ userId: 'admin-1', role: 'ADMIN' }],
    });
  });

  it('updates and deletes members', async () => {
    vi.mocked(requireRole).mockResolvedValue(adminMembership as never);
    vi.mocked(updateWorkspaceMemberRole).mockResolvedValueOnce({
      userId: 'user-2',
      role: 'EDITOR',
      updatedAt: new Date('2026-03-18T00:00:00.000Z'),
    } as never);
    vi.mocked(removeWorkspaceMember).mockResolvedValueOnce({} as never);

    const patchResponse = await updateMemberRoute(
      new NextRequest('http://localhost:3000/api/members/user-2', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'EDITOR' }),
      }),
      { params: Promise.resolve({ userId: 'user-2' }) },
    );
    expect(patchResponse.status).toBe(200);

    const deleteResponse = await deleteMemberRoute(
      new NextRequest('http://localhost:3000/api/members/user-2', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ userId: 'user-2' }) },
    );
    expect(deleteResponse.status).toBe(204);
  });

  it('revokes invitations and maps auth/service errors', async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new AuthError());

    const unauthorized = await createInvitationRoute(
      new NextRequest('http://localhost:3000/api/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: 'viewer@example.com',
          role: 'VIEWER',
        }),
      }),
    );
    expect(unauthorized.status).toBe(401);

    vi.mocked(requireRole).mockRejectedValueOnce(new ForbiddenError());
    const forbidden = await listMembersRoute();
    expect(forbidden.status).toBe(403);

    vi.mocked(getServerSession).mockResolvedValueOnce(null as never);
    const unauthAccept = await acceptInvitationRoute(
      new NextRequest('http://localhost:3000/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'abc' }),
      }),
    );
    expect(unauthAccept.status).toBe(401);

    vi.mocked(requireRole).mockResolvedValueOnce(adminMembership as never);
    vi.mocked(revokeInvitation).mockResolvedValueOnce({} as never);
    const revokeResponse = await revokeInvitationRoute(
      new NextRequest('http://localhost:3000/api/invitations/invite-1/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'invite-1' }) },
    );
    expect(revokeResponse.status).toBe(200);

    vi.mocked(requireRole).mockResolvedValueOnce(adminMembership as never);
    vi.mocked(updateWorkspaceMemberRole).mockRejectedValueOnce(
      new MembershipError('Cannot modify the last remaining admin', 409),
    );
    const conflict = await updateMemberRoute(
      new NextRequest('http://localhost:3000/api/members/admin-2', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'VIEWER' }),
      }),
      { params: Promise.resolve({ userId: 'admin-2' }) },
    );
    expect(conflict.status).toBe(409);
  });
});
