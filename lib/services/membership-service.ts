import type {
  Invitation,
  WorkspaceMember,
  WorkspaceRole,
} from '@prisma/client';

export type CreateInvitationInput = {
  email: string;
  role: WorkspaceRole;
  expiresInDays?: number;
};

export async function listWorkspaceMembers(): Promise<WorkspaceMember[]> {
  throw new Error('not implemented');
}

export async function createInvitation(
  _actorUserId: string,
  _input: CreateInvitationInput,
): Promise<Invitation> {
  void _actorUserId;
  void _input;
  throw new Error('not implemented');
}

export async function acceptInvitation(
  _token: string,
  _userId: string,
  _email: string,
): Promise<WorkspaceMember> {
  void _token;
  void _userId;
  void _email;
  throw new Error('not implemented');
}

export async function revokeInvitation(
  _invitationId: string,
  _actorUserId: string,
) {
  void _invitationId;
  void _actorUserId;
  throw new Error('not implemented');
}

export async function updateWorkspaceMemberRole(
  _targetUserId: string,
  _role: WorkspaceRole,
  _actorUserId: string,
) {
  void _targetUserId;
  void _role;
  void _actorUserId;
  throw new Error('not implemented');
}

export async function removeWorkspaceMember(
  _targetUserId: string,
  _actorUserId: string,
) {
  void _targetUserId;
  void _actorUserId;
  throw new Error('not implemented');
}
