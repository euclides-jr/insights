import { NextResponse } from 'next/server';
import { WorkspaceRole } from '@prisma/client';
import { AuthError, ForbiddenError, requireRole } from '@/lib/auth/roles';
import { listWorkspaceMembers, MembershipError } from '@/lib/services/membership-service';

function handleError(error: unknown) {
  if (error instanceof AuthError || error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof MembershipError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET() {
  try {
    await requireRole(WorkspaceRole.ADMIN);
    const members = await listWorkspaceMembers();

    return NextResponse.json({
      members: members.map((member) => ({
        userId: member.userId,
        email: member.user.email,
        name: member.user.name,
        role: member.role,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
      })),
    });
  } catch (error) {
    const handled = handleError(error);
    if (handled) return handled;
    console.error('GET /api/members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
