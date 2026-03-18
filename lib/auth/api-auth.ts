import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth';

/**
 * Verifies that the request is authenticated by either:
 *  1. A valid `X-API-Key` header (SDK / programmatic access), or
 *  2. A valid Better Auth session cookie (dashboard browser access).
 *
 * Returns `{ ok: true }` when authenticated, or
 * `{ ok: false, response }` with a 401 JSON response when not.
 */
export async function requireAuth(
  request: NextRequest,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    const app = await prisma.application.findUnique({
      where: { apiKey },
      select: { id: true },
    });
    if (!app) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
      };
    }
    return { ok: true };
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized – provide X-API-Key header or sign in' },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}
