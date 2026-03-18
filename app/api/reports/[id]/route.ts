import { NextRequest, NextResponse } from 'next/server';
import { Prisma, WorkspaceRole } from '@prisma/client';
import { AuthError, ForbiddenError, requireRole } from '@/lib/auth/roles';
import {
  deleteSavedReport,
  getSavedReport,
  updateSavedReport,
} from '@/lib/services/report-service';
import { updateSavedReportSchema } from '@/lib/validations/report-schemas';

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

    const report = await getSavedReport(id);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('GET /api/reports/[id] error:', error);
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
    const parsed = updateSavedReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const existing = await getSavedReport(id);
    if (!existing) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const report = await updateSavedReport(id, membership, {
      ...parsed.data,
      config:
        parsed.data.config === undefined
          ? undefined
          : (parsed.data.config as Prisma.JsonObject),
    });
    return NextResponse.json(report);
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('PATCH /api/reports/[id] error:', error);
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

    const existing = await getSavedReport(id);
    if (!existing) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    await deleteSavedReport(id, membership);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('DELETE /api/reports/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
