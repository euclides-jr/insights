import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';

// ─── Shared types ────────────────────────────────────────────────────────────

export type PropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface PropertyDef {
  type: PropertyType;
  required?: boolean;
  description?: string;
}

export interface SchemaDefinition {
  properties: Record<string, PropertyDef>;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const propertyDefSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  required: z.boolean().optional().default(false),
  description: z.string().optional(),
});

const createSchemaSchema = z.object({
  applicationId: z.string().uuid('applicationId must be a valid UUID'),
  eventName: z
    .string()
    .min(1, 'eventName is required')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'eventName may only contain letters, numbers and underscores',
    ),
  properties: z
    .record(
      z
        .string()
        .regex(
          /^[a-zA-Z_][a-zA-Z0-9_]*$/,
          'Property keys must be valid identifiers',
        ),
      propertyDefSchema,
    )
    .refine((p) => Object.keys(p).length > 0, {
      message: 'Schema must define at least one property',
    }),
});

// ─── GET /api/schemas ─────────────────────────────────────────────────────────
// Returns all schemas, sorted newest first. Optional ?applicationId= filter.

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!auth.ok) return authResult.response;
  try {
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get('pageSize') ?? '50')),
    );
    const skip = (page - 1) * pageSize;

    const where = {
      ...(applicationId ? { applicationId } : {}),
      ...(activeOnly ? { isActive: true } : {}),
    };

    const [schemas, totalCount] = await Promise.all([
      prisma.eventSchema.findMany({
        where,
        take: pageSize,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { application: { select: { id: true, name: true } } },
      }),
      prisma.eventSchema.count({ where }),
    ]);

    return NextResponse.json({
      schemas,
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

// ─── POST /api/schemas ────────────────────────────────────────────────────────
// Creates the first version of a schema for a given (applicationId, eventName).
// Returns 409 if an active schema already exists for that event name.

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!auth.ok) return authResult.response;
  try {
    const body = await request.json();
    const result = createSchemaSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.errors },
        { status: 400 },
      );
    }

    const { applicationId, eventName, properties } = result.data;

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

    // Reject if an active schema already exists for this event name
    const existing = await prisma.eventSchema.findFirst({
      where: { applicationId, eventName, isActive: true },
      select: { id: true, version: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: 'An active schema already exists for this event name',
          hint: `Use PUT /api/schemas/${existing.id} to create a new version`,
          existingSchemaId: existing.id,
        },
        { status: 409 },
      );
    }

    // Determine version (may have previous inactive schemas)
    const latest = await prisma.eventSchema.findFirst({
      where: { applicationId, eventName },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const schema = await prisma.eventSchema.create({
      data: {
        applicationId,
        eventName,
        version: nextVersion,
        schemaDefinition: { properties } as object,
        isActive: true,
      },
      include: { application: { select: { id: true, name: true } } },
    });

    return NextResponse.json(schema, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
