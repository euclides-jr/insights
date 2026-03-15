import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAttributeHistory } from '@/lib/services/user-attribute-service';

type Params = { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
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

  const { userId } = await params;
  const { searchParams } = new URL(req.url);

  const attributeKey = searchParams.get('attributeKey') ?? undefined;
  const since = searchParams.get('since') ?? undefined;
  const until = searchParams.get('until') ?? undefined;
  const atRaw = searchParams.get('at');

  // Validate dates if provided
  for (const [name, val] of [
    ['since', since],
    ['until', until],
    ['at', atRaw],
  ] as const) {
    if (val && isNaN(Date.parse(val))) {
      return NextResponse.json(
        { error: `Invalid ${name} date: must be ISO 8601` },
        { status: 400 },
      );
    }
  }

  const history = await getAttributeHistory(application.id, userId, {
    attributeKey,
    since: since ? new Date(since) : undefined,
    until: until ? new Date(until) : undefined,
    at: atRaw ? new Date(atRaw) : undefined,
  });

  return NextResponse.json(history);
}
