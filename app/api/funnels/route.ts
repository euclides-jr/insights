import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRole } from '@prisma/client';
import {
  AuthError,
  ForbiddenError,
  requireRole,
} from '@/lib/auth/roles';
import {
  createFunnelSchema,
  listFunnelsSchema,
} from '@/lib/validations/funnel-schemas';
import { createFunnel, listFunnels } from '@/lib/services/funnel-service';

function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(WorkspaceRole.VIEWER);

    const { searchParams } = new URL(request.url);
    const parsed = listFunnelsSchema.safeParse({
      applicationId: searchParams.get('applicationId') ?? undefined,
      q: searchParams.get('q') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const funnels = await listFunnels(parsed.data.applicationId, parsed.data.q);
    return NextResponse.json({ funnels });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('GET /api/funnels error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const membership = await requireRole(WorkspaceRole.EDITOR);

    const body = await request.json();
    const parsed = createFunnelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const funnel = await createFunnel(membership, parsed.data);
    return NextResponse.json(funnel, { status: 201 });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('POST /api/funnels error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
