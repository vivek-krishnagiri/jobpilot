import crypto from 'crypto';

// ─── Session store ────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SessionEntry {
  userId: number;
  username: string;
  expiresAt: number;
}

const store = new Map<string, SessionEntry>();

export function createSession(userId: number, username: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  store.set(token, { userId, username, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function getSession(token: string): { userId: number; username: string } | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(token);
    return null;
  }
  return { userId: entry.userId, username: entry.username };
}

export function deleteSession(token: string): void {
  store.delete(token);
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export const COOKIE_NAME = 'jp_session';

export function parseCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.split('=');
    if (rawKey.trim() === COOKIE_NAME) return rest.join('=').trim();
  }
  return null;
}

export function buildSetCookie(token: string, maxAge: number): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
