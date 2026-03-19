import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { getSafeRedirectPath } from '@/lib/auth/redirect';

const GUEST_ONLY_PATHS = new Set(['/sign-in']);
const PUBLIC_PATHS = new Set(['/accept-invitation']);
const PUBLIC_PREFIXES = ['/api'];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);
  const isPublicPath =
    GUEST_ONLY_PATHS.has(pathname) ||
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!sessionCookie && !isPublicPath) {
    const signInUrl = new URL('/sign-in', request.url);
    if (!pathname.startsWith('/api/')) {
      const redirectTo = getSafeRedirectPath(`${pathname}${search}`);
      signInUrl.searchParams.set('redirectTo', redirectTo);
    }
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
