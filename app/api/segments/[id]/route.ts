import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import {
  refreshSegmentCount,
  SegmentCriteria,
  evaluateSegment,
} from '@/lib/services/segment-engine';

// ─── Validation ───────────────────────────────────────────────────────────────

const eventFilterSchema = z.object({
  eventName: z.string().min(1),
  count: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    })
    .optional(),
  timeWindow: z
    .object({ value: z.number().int().min(1), unit: z.enum(['days', 'hours']) })
    .optional(),
  properties: z.record(z.unknown()).optional(),
});

const criteriaSchema = z.object({
  logic: z.enum(['AND', 'OR']),
  eventFilters: z.array(eventFilterSchema).min(1),
});

const updateSegmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  criteria: criteriaSchema.optional(),
  refresh: z.boolean().optional(), // trigger member count refresh
});

// ─── GET /api/segments/:id ────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const segment = await prisma.segment.findUnique({
      where: { id },
      include: { application: { select: { id: true, name: true } } },
    });

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    return NextResponse.json(segment);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ─── PUT /api/segments/:id ────────────────────────────────────────────────────
// Update name/description/criteria, or trigger a member count refresh.

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const existing = await prisma.segment.findUnique({
      where: { id },
      select: { id: true, applicationId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    const body = await request.json();
    const result = updateSegmentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.errors },
        { status: 400 },
      );
    }

    const { name, description, criteria, refresh } = result.data;

    // If criteria changed or refresh requested, re-evaluate member count
    let memberCount: number | undefined;
    if (criteria || refresh) {
      const targetCriteria = criteria
        ? (criteria as SegmentCriteria)
        : ((
            await prisma.segment.findUnique({
              where: { id },
              select: { criteria: true },
            })
          )?.criteria as unknown as SegmentCriteria);

      const userIds = await evaluateSegment(
        existing.applicationId,
        targetCriteria,
      );
      memberCount = userIds.size;
    }

    const updated = await prisma.segment.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(criteria ? { criteria: criteria as object } : {}),
        ...(memberCount !== undefined
          ? { memberCount, lastRefreshedAt: new Date() }
          : {}),
      },
      include: { application: { select: { id: true, name: true } } },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/segments/:id ─────────────────────────────────────────────────
// Hard delete (segments have no soft-delete requirement)

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const existing = await prisma.segment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    await prisma.segment.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
