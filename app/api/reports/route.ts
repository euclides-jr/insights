import { NextRequest, NextResponse } from 'next/server';
import { Prisma, WorkspaceRole } from '@prisma/client';
import { AuthError, ForbiddenError, requireRole } from '@/lib/auth/roles';
import {
  createSavedReportSchema,
  listSavedReportsSchema,
} from '@/lib/validations/report-schemas';
import {
  createSavedReport,
  listSavedReports,
} from '@/lib/services/report-service';

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
    const parsed = listSavedReportsSchema.safeParse({
      reportType: searchParams.get('reportType') ?? undefined,
      applicationId: searchParams.get('applicationId') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const reports = await listSavedReports(
      parsed.data.reportType,
      parsed.data.applicationId,
    );
    return NextResponse.json({ reports });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('GET /api/reports error:', error);
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
    const parsed = createSavedReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const report = await createSavedReport(membership, {
      ...parsed.data,
      applicationId: parsed.data.applicationId ?? null,
      config: parsed.data.config as Prisma.JsonObject,
    });
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;

    console.error('POST /api/reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
