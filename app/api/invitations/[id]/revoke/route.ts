import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRole } from '@prisma/client';
import { AuthError, ForbiddenError, requireRole } from '@/lib/auth/roles';
import { MembershipError, revokeInvitation } from '@/lib/services/membership-service';

type Params = { params: Promise<{ id: string }> };

function handleError(error: unknown) {
  if (error instanceof AuthError || error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof MembershipError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const membership = await requireRole(WorkspaceRole.ADMIN);
    const { id } = await params;

    await revokeInvitation(id, membership.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const handled = handleError(error);
    if (handled) return handled;
    console.error('POST /api/invitations/[id]/revoke error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
