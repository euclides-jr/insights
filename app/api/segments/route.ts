import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import {
  evaluateSegment,
  SegmentCriteria,
} from '@/lib/services/segment-engine';

// ─── Validation schemas ───────────────────────────────────────────────────────

const eventFilterSchema = z.object({
  eventName: z.string().min(1, 'eventName is required'),
  count: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    })
    .optional(),
  timeWindow: z
    .object({
      value: z.number().int().min(1),
      unit: z.enum(['days', 'hours']),
    })
    .optional(),
  properties: z.record(z.unknown()).optional(),
});

const criteriaSchema = z.object({
  logic: z.enum(['AND', 'OR']),
  eventFilters: z
    .array(eventFilterSchema)
    .min(1, 'At least one event filter is required'),
});

const createSegmentSchema = z.object({
  applicationId: z.string().uuid('applicationId must be a valid UUID'),
  name: z.string().min(1, 'name is required').max(100),
  description: z.string().max(500).optional(),
  criteria: criteriaSchema,
});

// ─── GET /api/segments ────────────────────────────────────────────────────────
// Returns all segments with pagination.
// Query params: applicationId, page, pageSize

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get('pageSize') ?? '20')),
    );
    const skip = (page - 1) * pageSize;

    const where = applicationId ? { applicationId } : {};

    const [segments, totalCount] = await Promise.all([
      prisma.segment.findMany({
        where,
        take: pageSize,
        skip,
        orderBy: { updatedAt: 'desc' },
        include: { application: { select: { id: true, name: true } } },
      }),
      prisma.segment.count({ where }),
    ]);

    return NextResponse.json({ segments, totalCount, page, pageSize });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ─── POST /api/segments ───────────────────────────────────────────────────────
// Creates a new segment, evaluates criteria immediately, stores memberCount.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = createSegmentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.errors },
        { status: 400 },
      );
    }

    const { applicationId, name, description, criteria } = result.data;

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, name: true },
    });
    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 },
      );
    }

    // Evaluate member count synchronously on creation
    const userIds = await evaluateSegment(
      applicationId,
      criteria as SegmentCriteria,
    );

    const segment = await prisma.segment.create({
      data: {
        applicationId,
        name,
        description,
        criteria: criteria as object,
        memberCount: userIds.size,
        lastRefreshedAt: new Date(),
      },
      include: { application: { select: { id: true, name: true } } },
    });

    return NextResponse.json(
      {
        ...segment,
        estimatedRefreshTime: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
