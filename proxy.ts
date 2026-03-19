import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { getSafeRedirectPath } from '@/lib/auth/redirect';

const GUEST_ONLY_PATHS = new Set(['/sign-in']);
const PUBLIC_PATHS = new Set(['/accept-invitation']);
const PUBLIC_API_PREFIXES = ['/api/auth'];
const PUBLIC_API_PATHS = new Set([
  '/api/events',
  '/api/users/identify',
  '/api/users/identify/batch',
]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);
  const isApiPath = pathname.startsWith('/api/');
  const isPublicApiPath =
    PUBLIC_API_PATHS.has(pathname) ||
    PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isPublicPath =
    GUEST_ONLY_PATHS.has(pathname) ||
    PUBLIC_PATHS.has(pathname) ||
    isPublicApiPath;

  if (!sessionCookie && !isPublicPath) {
    if (isApiPath) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const signInUrl = new URL('/sign-in', request.url);
    const redirectTo = getSafeRedirectPath(`${pathname}${search}`);
    signInUrl.searchParams.set('redirectTo', redirectTo);
    return NextResponse.redirect(signInUrl);
  }

  if (sessionCookie && GUEST_ONLY_PATHS.has(pathname)) {
    const redirectTo = getSafeRedirectPath(
      request.nextUrl.searchParams.get('redirectTo'),
    );
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
