import { NextRequest, NextResponse } from 'next/server';
import { buildCombinedUserQuery } from '@/lib/services/user-attribute-service';
import { combinedQuerySchema } from '@/lib/validations/user-schemas';

export async function POST(req: NextRequest) {
  // ── Body validation ───────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = combinedQuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const start = Date.now();
  try {
    const result = await buildCombinedUserQuery(
      parsed.data.applicationId,
      parsed.data,
    );
    return NextResponse.json({
      ...result,
      executionTimeMs: Date.now() - start,
    });
  } catch (err: unknown) {
    console.error('POST /api/users/query error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
