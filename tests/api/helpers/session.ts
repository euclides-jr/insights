const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_EMAIL = process.env.AUTH_ADMIN_EMAIL || 'admin@eventpulse.local';
const AUTH_PASSWORD = process.env.AUTH_ADMIN_PASSWORD || 'changeme12345';

let sessionCookiePromise: Promise<string> | null = null;

async function signInAndGetCookie() {
  const response = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: API_BASE_URL,
    },
    body: JSON.stringify({
      email: AUTH_EMAIL,
      password: AUTH_PASSWORD,
      rememberMe: true,
      callbackURL: '/',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sign in test session (${response.status})`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Missing session cookie from Better Auth sign-in');
  }

  return setCookie.split(';', 1)[0];
}

export async function getSessionCookie() {
  if (!sessionCookiePromise) {
    sessionCookiePromise = signInAndGetCookie();
  }

  return sessionCookiePromise;
}

export async function sessionFetch(
  input: string,
  init: RequestInit = {},
) {
  const cookie = await getSessionCookie();
  const headers = new Headers(init.headers);
  headers.set('Cookie', cookie);

  return fetch(input, {
    ...init,
    headers,
  });
}
