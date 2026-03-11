import crypto from 'crypto';
import db from '../db/index';

// ─── Session store (SQLite-backed, survives restarts) ─────────────────────────

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SessionRow {
  user_id: number;
  username: string;
  expires_at: number;
}

export function createSession(userId: number, username: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.prepare('INSERT INTO sessions (token, user_id, username, expires_at) VALUES (?, ?, ?, ?)').run(token, userId, username, expiresAt);
  return token;
}

export function getSession(token: string): { userId: number; username: string } | null {
  const row = db.prepare('SELECT user_id, username, expires_at FROM sessions WHERE token = ?').get(token) as SessionRow | undefined;
  if (!row) return null;
  if (Date.now() > row.expires_at) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { userId: row.user_id, username: row.username };
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
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
