import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRole } from '@prisma/client';
import {
  AuthError,
  ForbiddenError,
  requireRole,
} from '@/lib/auth/roles';
import { getFunnel, runFunnel } from '@/lib/services/funnel-service';
import { runFunnelSchema } from '@/lib/validations/funnel-schemas';

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

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireRole(WorkspaceRole.VIEWER);
    const { id } = await params;

    const body = await request.json();
    const parsed = runFunnelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const funnel = await getFunnel(id);
    if (!funnel) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }

    if (
      parsed.data.applicationId &&
      parsed.data.applicationId !== funnel.applicationId
    ) {
      return NextResponse.json(
        { error: 'applicationId does not match funnel application' },
        { status: 400 },
      );
    }

    const steps = await runFunnel(id, parsed.data);
    return NextResponse.json({
      funnelId: id,
      generatedAt: new Date().toISOString(),
      steps,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('POST /api/funnels/[id]/run error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
