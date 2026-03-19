import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { attributeSchemaRequestSchema } from '@/lib/validations/user-schemas';

const attributeSchemaListQuerySchema = z.object({
  applicationId: z.string().uuid('applicationId must be a valid UUID'),
});

// ── GET /api/users/attributes/schema ─────────────────────────────────────────
// List all attribute schemas for one application.
export async function GET(req: NextRequest) {
  const parsed = attributeSchemaListQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const schemas = await prisma.userAttributeSchema.findMany({
    where: { applicationId: parsed.data.applicationId },
    orderBy: { attributeKey: 'asc' },
  });

  return NextResponse.json({ schemas });
}

// ── POST /api/users/attributes/schema ────────────────────────────────────────
// Register or update an attribute schema entry
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = attributeSchemaRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { applicationId, attributeKey, valueType, description, isIndexed } =
    parsed.data;

  const schema = await prisma.userAttributeSchema.upsert({
    where: {
      applicationId_attributeKey: {
        applicationId,
        attributeKey,
      },
    },
    create: {
      applicationId,
      attributeKey,
      valueType,
      description: description ?? null,
      isIndexed: isIndexed ?? false,
    },
    update: {
      valueType,
      description: description ?? null,
      isIndexed: isIndexed ?? false,
    },
  });

  return NextResponse.json({ schema }, { status: 201 });
}
