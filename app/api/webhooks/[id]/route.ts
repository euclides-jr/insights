import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  secret: z.string().max(256).nullable().optional(),
  minLevel: z.enum(['warning', 'error']).optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

function safe(wh: { secret: string | null; [key: string]: unknown }) {
  return { ...wh, secret: wh.secret ? '••••••••' : null };
}

// ─── GET /api/webhooks/[id] ───────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const wh = await prisma.webhookAlert.findUnique({
    where: { id },
    include: { application: { select: { id: true, name: true } } },
  });
  if (!wh) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(safe(wh));
}

// ─── PATCH /api/webhooks/[id] ─────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const wh = await prisma.webhookAlert.update({
      where: { id },
      data: parsed.data,
      include: { application: { select: { id: true, name: true } } },
    });

    return NextResponse.json(safe(wh));
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/webhooks/[id] ────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.webhookAlert.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
