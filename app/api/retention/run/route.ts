import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRole } from '@prisma/client';
import {
  AuthError,
  ForbiddenError,
  requireRole,
} from '@/lib/auth/roles';
import { runRetention } from '@/lib/services/retention-service';
import { runRetentionSchema } from '@/lib/validations/retention-schemas';

function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(WorkspaceRole.VIEWER);

    const body = await request.json();
    const parsed = runRetentionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const result = await runRetention(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('POST /api/retention/run error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
