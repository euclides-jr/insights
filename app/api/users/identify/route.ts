import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { identifyRequestSchema } from '@/lib/validations/user-schemas';
import { upsertUserProfile } from '@/lib/services/user-attribute-service';

/**
 * POST /api/users/identify
 *
 * Creates or updates a user profile with optional attributes.
 * Existing attributes not present in the request are preserved (merge patch).
 *
 * Authentication: X-API-Key header
 *
 * @example
 * ```json
 * {
 *   "userId": "user_abc123",
 *   "attributes": { "plan": "pro", "country": "US" }
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing X-API-Key header' },
        { status: 401 },
      );
    }

    const application = await prisma.application.findUnique({
      where: { apiKey },
      select: { id: true },
    });
    if (!application) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });
    }

    // 2. Parse and validate body
    const body = await request.json();
    const validation = identifyRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 },
      );
    }

    // 3. Upsert profile
    const profile = await upsertUserProfile(application.id, validation.data);

    return NextResponse.json(profile, { status: 200 });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 400) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e.statusCode === 413) {
      return NextResponse.json({ error: e.message }, { status: 413 });
    }
    console.error('POST /api/users/identify error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
