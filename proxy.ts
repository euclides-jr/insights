import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { getSafeRedirectPath } from '@/lib/auth/redirect';

const PUBLIC_PATHS = new Set(['/sign-in']);
const PUBLIC_PREFIXES = ['/api/auth/'];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);
  // All /api/ routes bypass the session-cookie redirect: each route handler
  // enforces its own authentication (requireAuth() for dashboard routes,
  // X-API-Key for ingestion routes). Middleware only protects dashboard pages.
  const isPublicPath =
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.startsWith('/api/');

  if (!sessionCookie && !isPublicPath) {
    const signInUrl = new URL('/sign-in', request.url);
    const redirectTo = getSafeRedirectPath(`${pathname}${search}`);
    signInUrl.searchParams.set('redirectTo', redirectTo);
    return NextResponse.redirect(signInUrl);
  }

  if (sessionCookie && PUBLIC_PATHS.has(pathname)) {
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
