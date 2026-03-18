import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import type { SchemaDefinition } from '../route';
import { requireAuth } from '@/lib/auth/api-auth';

// ─── Validation ──────────────────────────────────────────────────────────────

const propertyDefSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  required: z.boolean().optional().default(false),
  description: z.string().optional(),
});

const updateSchemaSchema = z.object({
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
    })
    .optional(),
  isActive: z.boolean().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Params = Promise<{ id: string }>;

// ─── GET /api/schemas/:id ─────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.response;
  try {
    const { id } = await params;

    const schema = await prisma.eventSchema.findUnique({
      where: { id },
      include: { application: { select: { id: true, name: true } } },
    });

    if (!schema) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }

    // Also return all versions of this (applicationId, eventName)
    const allVersions = await prisma.eventSchema.findMany({
      where: {
        applicationId: schema.applicationId,
        eventName: schema.eventName,
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, isActive: true, createdAt: true },
    });

    return NextResponse.json({ ...schema, versions: allVersions });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ─── PUT /api/schemas/:id ─────────────────────────────────────────────────────
// Updating an active schema's properties creates a new version (v+1) and
// deactivates the current one — schema versioning.
// Setting isActive: false just deactivates without creating a new version.

export async function PUT(
  request: NextRequest,
  { params }: { params: Params },
) {
  const authResult = await requireAuth(request);
  if (!authResult.ok) return authResult.response;
  try {
    const { id } = await params;

    const existing = await prisma.eventSchema.findUnique({
      where: { id },
      select: {
        id: true,
        applicationId: true,
        eventName: true,
        version: true,
        isActive: true,
        schemaDefinition: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }

    const body = await request.json();
    const result = updateSchemaSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.errors },
        { status: 400 },
      );
    }

    const { properties, isActive } = result.data;

    // Case 1: Only toggling isActive (no property changes)
    if (!properties && isActive !== undefined) {
      const updated = await prisma.eventSchema.update({
        where: { id },
        data: { isActive },
        include: { application: { select: { id: true, name: true } } },
      });
      return NextResponse.json(updated);
    }

    // Case 2: Property update → create new version, deactivate old
    if (properties) {
      // Make sure this schema is still active (can't bump a deactivated schema)
      if (!existing.isActive) {
        return NextResponse.json(
          {
            error:
              'Cannot update an inactive schema. Activate it first or create a new one.',
          },
          { status: 422 },
        );
      }

      const [, newSchema] = await prisma.$transaction([
        // Deactivate the current version
        prisma.eventSchema.update({
          where: { id },
          data: { isActive: false },
        }),
        // Create the new version
        prisma.eventSchema.create({
          data: {
            applicationId: existing.applicationId,
            eventName: existing.eventName,
            version: existing.version + 1,
            schemaDefinition: { properties } as object,
            isActive: isActive ?? true,
          },
        }),
      ]);

      const newSchemaWithApp = await prisma.eventSchema.findUnique({
        where: { id: newSchema.id },
        include: { application: { select: { id: true, name: true } } },
      });

      return NextResponse.json(newSchemaWithApp, { status: 201 });
    }

    // No-op (empty body that passed validation) — return as-is
    const current = await prisma.eventSchema.findUnique({
      where: { id },
      include: { application: { select: { id: true, name: true } } },
    });
    return NextResponse.json(current);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/schemas/:id ──────────────────────────────────────────────────
// Soft-deletes: sets isActive = false. Hard delete is blocked at DB level if
// events reference the schema's eventName.

export async function DELETE(
  req: NextRequest,
  { params }: { params: Params },
) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.response;
  try {
    const { id } = await params;

    const existing = await prisma.eventSchema.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }

    // Validate the schemaDefinition shape for completeness type-check
    // (we have it available for future use)
    const _def = existing as unknown as { schemaDefinition: SchemaDefinition };
    void _def;

    await prisma.eventSchema.update({
      where: { id },
      data: { isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
