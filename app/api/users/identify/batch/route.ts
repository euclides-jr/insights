import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { batchIdentifySchema } from '@/lib/validations/user-schemas';
import { upsertUserProfile } from '@/lib/services/user-attribute-service';

/**
 * POST /api/users/identify/batch
 *
 * Identify up to 100 users in a single request (FR-015).
 * Each entry is processed sequentially; failures are collected and reported
 * without aborting the remaining items.
 *
 * Authentication: X-API-Key header
 *
 * @example
 * ```json
 * [
 *   { "userId": "user_1", "attributes": { "plan": "pro" } },
 *   { "userId": "user_2", "attributes": { "plan": "free" } }
 * ]
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

    // 2. Parse and validate batch body
    const body = await request.json();
    const validation = batchIdentifySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 },
      );
    }

    if (validation.data.length > 100) {
      return NextResponse.json(
        { error: 'Batch cannot exceed 100 items' },
        { status: 400 },
      );
    }

    // 3. Process each identify request; collect failures without aborting
    let processed = 0;
    const errors: Array<{ index: number; userId: string; message: string }> =
      [];

    for (let i = 0; i < validation.data.length; i++) {
      const item = validation.data[i];
      try {
        await upsertUserProfile(application.id, item);
        processed++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ index: i, userId: item.userId, message });
      }
    }

    const response: Record<string, unknown> = {
      processed,
      failed: errors.length,
    };
    if (errors.length > 0) response.errors = errors;

    return NextResponse.json(response, { status: 200 });
  } catch (err: unknown) {
    console.error('POST /api/users/identify/batch error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
