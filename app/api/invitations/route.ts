import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRole } from '@prisma/client';
import { AuthError, ForbiddenError, requireRole } from '@/lib/auth/roles';
import {
  CreateInvitationInput,
  createInvitation,
  MembershipError,
} from '@/lib/services/membership-service';
import { createInvitationSchema } from '@/lib/validations/admin-schemas';

function handleError(error: unknown) {
  if (error instanceof AuthError || error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof MembershipError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const membership = await requireRole(WorkspaceRole.ADMIN);
    const body = await request.json();
    const parsed = createInvitationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const invitation = await createInvitation(
      membership.userId,
      parsed.data as CreateInvitationInput,
    );

    return NextResponse.json(
      {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        inviteUrl: invitation.inviteUrl,
        createdAt: invitation.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    const handled = handleError(error);
    if (handled) return handled;
    console.error('POST /api/invitations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
