import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth';

type AuthOk =
  | { ok: true; applicationId: string; session: null }
  | { ok: true; applicationId: null; session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>> };

type AuthFail = { ok: false; response: NextResponse };

/**
 * Verifies that the request is authenticated by either:
 *  1. A valid `X-API-Key` header (SDK / programmatic access), or
 *  2. A valid Better Auth session cookie (dashboard browser access).
 *
 * Returns an auth context on success, or `{ ok: false, response }` with a
 * 401 JSON response on failure.
 */
export async function requireAuth(
  request: NextRequest,
): Promise<AuthOk | AuthFail> {
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
    return { ok: true, applicationId: app.id, session: null };
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

  return { ok: true, applicationId: null, session };
}
