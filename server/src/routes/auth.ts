import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import db from '../db/index';
import { createSession, deleteSession, parseCookieToken, buildSetCookie, buildClearCookie, COOKIE_NAME } from '../auth/session';
import { requireAuth } from '../auth/middleware';

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

export async function authRoutes(fastify: FastifyInstance) {

  // POST /api/auth/login
  fastify.post<{ Body: { username: string; password: string } }>('/auth/login', async (request, reply) => {
    const { username, password } = request.body ?? {};
    if (!username || !password) {
      return reply.status(400).send({ error: 'username and password are required.' });
    }

    const user = db
      .prepare('SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE')
      .get(username) as UserRow | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return reply.status(401).send({ error: 'Invalid username or password.' });
    }

    const token = createSession(user.id, user.username);
    reply
      .header('Set-Cookie', buildSetCookie(token, SESSION_MAX_AGE))
      .send({ user: { id: user.id, username: user.username } });
  });

  // POST /api/auth/signup
  fastify.post<{ Body: { username: string; password: string } }>('/auth/signup', async (request, reply) => {
    const { username, password } = request.body ?? {};
    if (!username || !password) {
      return reply.status(400).send({ error: 'username and password are required.' });
    }
    if (username.length < 2 || username.length > 30) {
      return reply.status(400).send({ error: 'Username must be 2–30 characters.' });
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: 'Password must be at least 6 characters.' });
    }

    const existing = db
      .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
      .get(username) as { id: number } | undefined;

    if (existing) {
      return reply.status(409).send({ error: 'Username already taken.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(username, hash);
    const userId = Number(result.lastInsertRowid);

    // Create blank profile for new user
    db.prepare('INSERT INTO applicant_profile (user_id, updated_at) VALUES (?, ?)').run(
      userId,
      new Date().toISOString(),
    );

    const token = createSession(userId, username);
    reply
      .status(201)
      .header('Set-Cookie', buildSetCookie(token, SESSION_MAX_AGE))
      .send({ user: { id: userId, username } });
  });

  // POST /api/auth/logout
  fastify.post('/auth/logout', async (request, reply) => {
    const token = parseCookieToken(request.headers.cookie);
    if (token) deleteSession(token);
    reply
      .header('Set-Cookie', buildClearCookie())
      .send({ ok: true });
  });

  // GET /api/auth/me
  fastify.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    reply.send({ user: request.user });
  });

  // Expose cookie name so client can check
  void COOKIE_NAME;
}
