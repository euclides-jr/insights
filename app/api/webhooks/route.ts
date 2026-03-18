import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/api-auth';

const createSchema = z.object({
  applicationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  url: z.string().url(),
  secret: z.string().max(256).optional(),
  minLevel: z.enum(['warning', 'error']).default('error'),
  isActive: z.boolean().default(true),
});

// ─── GET /api/webhooks ────────────────────────────────────────────────────────
// Query params: applicationId, page, pageSize

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;
  try {
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get('pageSize') ?? '50')),
    );
    const skip = (page - 1) * pageSize;

    const where = applicationId ? { applicationId } : {};

    const [webhooks, totalCount] = await Promise.all([
      prisma.webhookAlert.findMany({
        where,
        take: pageSize,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { application: { select: { id: true, name: true } } },
      }),
      prisma.webhookAlert.count({ where }),
    ]);

    // Redact secrets from response
    const safeWebhooks = webhooks.map((wh) => ({
      ...wh,
      secret: wh.secret ? '••••••••' : null,
    }));

    return NextResponse.json({
      webhooks: safeWebhooks,
      totalCount,
      page,
      pageSize,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ─── POST /api/webhooks ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 },
      );
    }

    // Verify application exists
    const app = await prisma.application.findUnique({
      where: { id: parsed.data.applicationId },
      select: { id: true },
    });
    if (!app) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 },
      );
    }

    const webhook = await prisma.webhookAlert.create({
      data: parsed.data,
      include: { application: { select: { id: true, name: true } } },
    });

    return NextResponse.json(
      { ...webhook, secret: webhook.secret ? '••••••••' : null },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
