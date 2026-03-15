import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { buildCombinedUserQuery } from '@/lib/services/user-attribute-service';
import { combinedQuerySchema } from '@/lib/validations/user-schemas';

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }
  const application = await prisma.application.findUnique({
    where: { apiKey },
    select: { id: true },
  });
  if (!application) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });
  }

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
    const result = await buildCombinedUserQuery(application.id, parsed.data);
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
