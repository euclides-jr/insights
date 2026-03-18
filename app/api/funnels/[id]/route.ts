import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRole } from '@prisma/client';
import {
  AuthError,
  ForbiddenError,
  requireRole,
} from '@/lib/auth/roles';
import { getFunnel, updateFunnel, deleteFunnel } from '@/lib/services/funnel-service';
import { updateFunnelSchema } from '@/lib/validations/funnel-schemas';

type Params = { params: Promise<{ id: string }> };

function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireRole(WorkspaceRole.VIEWER);
    const { id } = await params;

    const funnel = await getFunnel(id);
    if (!funnel) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }

    return NextResponse.json(funnel);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('GET /api/funnels/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const membership = await requireRole(WorkspaceRole.EDITOR);
    const { id } = await params;

    const body = await request.json();
    const parsed = updateFunnelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const existing = await getFunnel(id);
    if (!existing) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }

    const funnel = await updateFunnel(id, membership, parsed.data);
    return NextResponse.json(funnel);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('PATCH /api/funnels/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const membership = await requireRole(WorkspaceRole.EDITOR);
    const { id } = await params;

    const existing = await getFunnel(id);
    if (!existing) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }

    await deleteFunnel(id, membership);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('DELETE /api/funnels/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
