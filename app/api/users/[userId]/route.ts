import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  getUserProfile,
  getAttributeHistory,
} from '@/lib/services/user-attribute-service';

/**
 * GET /api/users/:userId
 *
 * Retrieve a user profile by userId. When ?includeHistory=true is passed,
 * the full attribute change log is included in the response.
 *
 * Authentication: X-API-Key header
 *
 * Query params:
 *   includeHistory  boolean  Include attribute change history (default false)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
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

    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const atParam = searchParams.get('at');

    // 2. Fetch profile
    const profile = await getUserProfile(application.id, userId);
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!includeHistory) {
      return NextResponse.json(profile);
    }

    // 3. Optionally fetch history
    const atDate = atParam ? new Date(atParam) : undefined;
    const historyResult = await getAttributeHistory(application.id, userId, {
      at: atDate,
    });

    return NextResponse.json({ ...profile, history: historyResult.history });
  } catch (err: unknown) {
    console.error('GET /api/users/[userId] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
