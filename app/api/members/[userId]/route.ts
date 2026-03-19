import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRole } from '@prisma/client';
import { AuthError, ForbiddenError, requireRole } from '@/lib/auth/roles';
import {
  MembershipError,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '@/lib/services/membership-service';
import { updateMemberRoleSchema } from '@/lib/validations/admin-schemas';

type Params = { params: Promise<{ userId: string }> };

function handleError(error: unknown) {
  if (error instanceof AuthError || error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof MembershipError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const membership = await requireRole(WorkspaceRole.ADMIN);
    const { userId } = await params;
    const body = await request.json();
    const parsed = updateMemberRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const member = await updateWorkspaceMemberRole(
      userId,
      parsed.data.role,
      membership.userId,
    );

    return NextResponse.json({
      userId: member.userId,
      role: member.role,
      updatedAt: member.updatedAt,
    });
  } catch (error) {
    const handled = handleError(error);
    if (handled) return handled;
    console.error('PATCH /api/members/[userId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const membership = await requireRole(WorkspaceRole.ADMIN);
    const { userId } = await params;

    await removeWorkspaceMember(userId, membership.userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const handled = handleError(error);
    if (handled) return handled;
    console.error('DELETE /api/members/[userId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
