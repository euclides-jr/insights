import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_EMAIL = process.env.AUTH_ADMIN_EMAIL || 'admin@eventpulse.local';
const AUTH_PASSWORD = process.env.AUTH_ADMIN_PASSWORD || 'changeme12345';
const SESSION_CACHE_DIR = path.join(tmpdir(), 'insights-vitest-auth');
const SESSION_COOKIE_PATH = path.join(SESSION_CACHE_DIR, 'session-cookie.txt');
const SESSION_LOCK_PATH = path.join(SESSION_CACHE_DIR, 'session-cookie.lock');
const SESSION_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const LOCK_WAIT_MS = 100;
const MAX_LOCK_ATTEMPTS = 100;

let sessionCookiePromise: Promise<string> | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureCacheDir() {
  await mkdir(SESSION_CACHE_DIR, { recursive: true });
}

async function readCachedCookie() {
  try {
    const [cookie, info] = await Promise.all([
      readFile(SESSION_COOKIE_PATH, 'utf8'),
      stat(SESSION_COOKIE_PATH),
    ]);

    if (Date.now() - info.mtimeMs > SESSION_CACHE_MAX_AGE_MS) {
      return null;
    }

    const trimmedCookie = cookie.trim();
    return trimmedCookie.length > 0 ? trimmedCookie : null;
  } catch {
    return null;
  }
}

async function withSessionLock<T>(fn: () => Promise<T>) {
  await ensureCacheDir();

  for (let attempt = 0; attempt < MAX_LOCK_ATTEMPTS; attempt += 1) {
    try {
      await mkdir(SESSION_LOCK_PATH);
      try {
        return await fn();
      } finally {
        await rm(SESSION_LOCK_PATH, { recursive: true, force: true });
      }
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !('code' in error) ||
        error.code !== 'EEXIST'
      ) {
        throw error;
      }

      const cachedCookie = await readCachedCookie();
      if (cachedCookie) {
        return cachedCookie as T;
      }

      await sleep(LOCK_WAIT_MS);
    }
  }

  throw new Error('Timed out waiting for shared test session cookie');
}

async function signInAndGetCookie() {
  const cachedCookie = await readCachedCookie();
  if (cachedCookie) {
    return cachedCookie;
  }

  return withSessionLock(async () => {
    const existingCookie = await readCachedCookie();
    if (existingCookie) {
      return existingCookie;
    }

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

    const cookie = setCookie.split(';', 1)[0];
    await ensureCacheDir();
    await writeFile(SESSION_COOKIE_PATH, cookie, 'utf8');

    return cookie;
  });
}

export async function getSessionCookie() {
  if (!sessionCookiePromise) {
    sessionCookiePromise = signInAndGetCookie().catch((error) => {
      sessionCookiePromise = null;
      throw error;
    });
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
