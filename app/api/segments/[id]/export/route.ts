import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getSegmentMembers, SegmentCriteria } from '@/lib/services/segment-engine';
import { requireAuth } from '@/lib/auth/api-auth';

// ─── GET /api/segments/:id/export ────────────────────────────────────────────
//
// Query params:
//   format – "json" (default) | "csv"
//
// JSON response:
//   { users: [...], segmentName, exportedAt, totalCount }
//
// CSV response:
//   userId,lastEventDate,eventCount
//   (with Content-Disposition: attachment header)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth(request);
  if (!auth.ok) return authResult.response;
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') ?? 'json';

    if (format !== 'json' && format !== 'csv') {
      return NextResponse.json(
        { error: 'Invalid format. Use "json" or "csv"' },
        { status: 400 },
      );
    }

    const segment = await prisma.segment.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        applicationId: true,
        criteria: true,
      },
    });

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    const members = await getSegmentMembers(
      segment.applicationId,
      segment.criteria as unknown as SegmentCriteria,
    );

    const exportedAt = new Date().toISOString();

    if (format === 'csv') {
      const lines = ['userId,lastEventDate,eventCount'];
      for (const m of members) {
        lines.push(`${m.userId},${m.lastEventDate},${m.eventCount}`);
      }
      const csv = lines.join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="segment-${id}-${exportedAt.slice(0, 10)}.csv"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      users: members,
      segmentName: segment.name,
      exportedAt,
      totalCount: members.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
