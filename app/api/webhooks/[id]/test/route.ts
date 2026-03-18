import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { buildTestPayload } from '@/lib/services/webhook-service';
import { createHmac } from 'crypto';
import { requireAuth } from '@/lib/auth/api-auth';

type Params = { params: Promise<{ id: string }> };

// ─── POST /api/webhooks/[id]/test ─────────────────────────────────────────────
// Sends a synthetic test payload to the configured URL and returns the result.

export async function POST(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth(req);
  if (!auth.ok) return authResult.response;
  const { id } = await params;

  const wh = await prisma.webhookAlert.findUnique({
    where: { id },
    include: { application: { select: { id: true, name: true } } },
  });

  if (!wh) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  const payload = buildTestPayload(wh.applicationId, wh.application.name);
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'EventPulse-Webhooks/1.0',
    'X-Webhook-Test': 'true',
  };

  if (wh.secret) {
    const hmac = createHmac('sha256', wh.secret);
    hmac.update(body);
    headers['X-Webhook-Signature'] = `sha256=${hmac.digest('hex')}`;
  }

  let status = 0;
  let error: string | null = null;

  try {
    const res = await fetch(wh.url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Network error';
  }

  // Record the test delivery
  await prisma.webhookAlert.update({
    where: { id },
    data: { lastTriggeredAt: new Date(), lastStatus: status || null },
  });

  return NextResponse.json({
    success: status >= 200 && status < 300,
    status,
    error,
    payload,
  });
}
