import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep } from 'jest-mock-extended';

vi.mock('@/lib/db/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import {
  acceptInvitation,
  createInvitation,
  listWorkspaceMembers,
  MembershipError,
  membershipTestUtils,
  removeWorkspaceMember,
  revokeInvitation,
  updateWorkspaceMemberRole,
} from '@/lib/services/membership-service';
import { prismaMock } from './prisma-singleton';

describe('membership-service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists workspace members with user details', async () => {
    prismaMock.workspaceMember.findMany.mockResolvedValueOnce([] as never);
    await listWorkspaceMembers();
    expect(prismaMock.workspaceMember.findMany).toHaveBeenCalled();
  });

  it('creates an invitation and returns an invite url', async () => {
    prismaMock.workspaceMember.findUnique.mockResolvedValueOnce({
      userId: 'admin-1',
      role: 'ADMIN',
    } as never);
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.invitation.findFirst.mockResolvedValueOnce(null);
    prismaMock.invitation.create.mockResolvedValueOnce({
      id: 'invite-1',
      email: 'viewer@example.com',
      role: 'VIEWER',
      expiresAt: new Date('2026-03-25T00:00:00.000Z'),
      createdAt: new Date('2026-03-18T00:00:00.000Z'),
    } as never);

    const invite = await createInvitation('admin-1', {
      email: 'viewer@example.com',
      role: 'VIEWER',
    });

    expect(invite.inviteUrl).toContain('/accept-invitation?token=');
    expect(prismaMock.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'viewer@example.com',
          role: 'VIEWER',
          invitedByUserId: 'admin-1',
          token: expect.any(String),
          tokenHash: expect.any(String),
        }),
      }),
    );
  });

  it('accepts a valid invitation and creates membership', async () => {
    const token = 'token-123';
    prismaMock.invitation.findUnique.mockResolvedValueOnce({
      id: 'invite-1',
      email: 'viewer@example.com',
      role: 'VIEWER',
      invitedByUserId: 'admin-1',
      expiresAt: new Date(Date.now() + 86_400_000),
      acceptedAt: null,
    } as never);
    prismaMock.workspaceMember.findUnique.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockResolvedValueOnce([
      {},
      {
        userId: 'user-2',
        role: 'VIEWER',
      },
    ] as never);

    const membership = await acceptInvitation(
      token,
      'user-2',
      'viewer@example.com',
    );

    expect(membership.userId).toBe('user-2');
    expect(prismaMock.invitation.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: membershipTestUtils.hashInvitationToken(token) },
    });
  });

  it('rejects accepting an invite for a different email', async () => {
    prismaMock.invitation.findUnique.mockResolvedValueOnce({
      id: 'invite-1',
      email: 'viewer@example.com',
      role: 'VIEWER',
      invitedByUserId: 'admin-1',
      expiresAt: new Date(Date.now() + 86_400_000),
      acceptedAt: null,
    } as never);

    await expect(
      acceptInvitation('token-123', 'user-2', 'other@example.com'),
    ).rejects.toMatchObject<Partial<MembershipError>>({
      status: 409,
    });
  });

  it('prevents demoting the last remaining admin', async () => {
    prismaMock.workspaceMember.findUnique
      .mockResolvedValueOnce({ userId: 'admin-1', role: 'ADMIN' } as never)
      .mockResolvedValueOnce({
        userId: 'admin-2',
        role: 'ADMIN',
        user: { id: 'admin-2', email: 'a@example.com', name: 'A' },
      } as never)
      .mockResolvedValueOnce({ userId: 'admin-2', role: 'ADMIN' } as never);
    prismaMock.workspaceMember.count.mockResolvedValueOnce(1);

    await expect(
      updateWorkspaceMemberRole('admin-2', 'VIEWER', 'admin-1'),
    ).rejects.toMatchObject<Partial<MembershipError>>({
      status: 409,
    });
  });

  it('prevents removing yourself', async () => {
    prismaMock.workspaceMember.findUnique.mockResolvedValueOnce({
      userId: 'admin-1',
      role: 'ADMIN',
    } as never);

    await expect(removeWorkspaceMember('admin-1', 'admin-1')).rejects.toMatchObject<
      Partial<MembershipError>
    >({
      status: 409,
    });
  });

  it('revokes an unaccepted invitation', async () => {
    prismaMock.workspaceMember.findUnique.mockResolvedValueOnce({
      userId: 'admin-1',
      role: 'ADMIN',
    } as never);
    prismaMock.invitation.findUnique.mockResolvedValueOnce({
      id: 'invite-1',
      acceptedAt: null,
    } as never);
    prismaMock.invitation.delete.mockResolvedValueOnce({ id: 'invite-1' } as never);

    await revokeInvitation('invite-1', 'admin-1');

    expect(prismaMock.invitation.delete).toHaveBeenCalledWith({
      where: { id: 'invite-1' },
    });
  });
});
