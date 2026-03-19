import { NextRequest, NextResponse } from 'next/server';
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
 * Query params:
 *   applicationId   string   Application scope for this user lookup
 *   includeHistory  boolean  Include attribute change history (default false)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId');
    if (!applicationId) {
      return NextResponse.json(
        { error: 'applicationId is required' },
        { status: 400 },
      );
    }
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const atParam = searchParams.get('at');

    // 2. Fetch profile
    const profile = await getUserProfile(applicationId, userId);
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!includeHistory) {
      return NextResponse.json(profile);
    }

    // 3. Optionally fetch history
    const atDate = atParam ? new Date(atParam) : undefined;
    const historyResult = await getAttributeHistory(applicationId, userId, {
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
