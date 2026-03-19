import { NextRequest, NextResponse } from 'next/server';
import { acceptInvitation, MembershipError } from '@/lib/services/membership-service';
import { acceptInvitationSchema } from '@/lib/validations/admin-schemas';
import { getServerSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = acceptInvitationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const membership = await acceptInvitation(
      parsed.data.token,
      session.user.id,
      session.user.email,
    );

    return NextResponse.json({ membership });
  } catch (error) {
    if (error instanceof MembershipError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/invitations/accept error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
