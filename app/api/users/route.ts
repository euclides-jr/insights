import { NextRequest, NextResponse } from 'next/server';
import { listUsers } from '@/lib/services/user-attribute-service';
import { attributeFilterSchema } from '@/lib/validations/user-schemas';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get('applicationId');
  if (!applicationId) {
    return NextResponse.json(
      { error: 'applicationId is required' },
      { status: 400 },
    );
  }

  // ── Parse filters from query param ───────────────────────────────────────
  const filtersRaw = searchParams.get('filters');
  let filters: z.infer<typeof attributeFilterSchema>[] = [];
  if (filtersRaw) {
    try {
      const parsed = JSON.parse(filtersRaw);
      const validation = z.array(attributeFilterSchema).safeParse(parsed);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid filters', details: validation.error.flatten() },
          { status: 400 },
        );
      }
      filters = validation.data;
    } catch {
      return NextResponse.json(
        { error: 'filters must be valid JSON' },
        { status: 400 },
      );
    }
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)),
  );
  const sortBy =
    (searchParams.get('sortBy') as
      | 'lastSeen'
      | 'firstSeen'
      | 'eventCount'
      | 'userId') ?? 'lastSeen';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') ?? 'desc';

  const start = Date.now();
  try {
    const result = await listUsers(applicationId, {
      filters,
      eventFilters: [],
      sortBy,
      sortOrder,
      page,
      pageSize,
    });

    return NextResponse.json({
      ...result,
      executionTimeMs: Date.now() - start,
    });
  } catch (err: unknown) {
    console.error('GET /api/users error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
