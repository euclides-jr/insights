import { NextRequest, NextResponse } from 'next/server';
import { getAttributeHistory } from '@/lib/services/user-attribute-service';

type Params = { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { userId } = await params;
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get('applicationId');
  if (!applicationId) {
    return NextResponse.json(
      { error: 'applicationId is required' },
      { status: 400 },
    );
  }

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

  const history = await getAttributeHistory(applicationId, userId, {
    attributeKey,
    since: since ? new Date(since) : undefined,
    until: until ? new Date(until) : undefined,
    at: atRaw ? new Date(atRaw) : undefined,
  });

  return NextResponse.json(history);
}
