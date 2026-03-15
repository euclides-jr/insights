import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { attributeSchemaRequestSchema } from '@/lib/validations/user-schemas';

// ── GET /api/users/attributes/schema ─────────────────────────────────────────
// List all attribute schemas for the authenticated application
export async function GET(req: NextRequest) {
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

  const schemas = await prisma.userAttributeSchema.findMany({
    where: { applicationId: application.id },
    orderBy: { attributeKey: 'asc' },
  });

  return NextResponse.json({ schemas });
}

// ── POST /api/users/attributes/schema ────────────────────────────────────────
// Register or update an attribute schema entry
export async function POST(req: NextRequest) {
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

  const { attributeKey, valueType, description, isIndexed } = parsed.data;

  const schema = await prisma.userAttributeSchema.upsert({
    where: {
      applicationId_attributeKey: {
        applicationId: application.id,
        attributeKey,
      },
    },
    create: {
      applicationId: application.id,
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
