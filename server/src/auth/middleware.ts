import type { FastifyRequest, FastifyReply } from 'fastify';
import { parseCookieToken, getSession } from './session';

// ─── Extend FastifyRequest with user ─────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    user?: { userId: number; username: string };
  }
}

// ─── Global cookie → request.user populator ──────────────────────────────────

export function populateUser(request: FastifyRequest): void {
  const token = parseCookieToken(request.headers.cookie);
  if (!token) return;
  const session = getSession(token);
  if (session) request.user = session;
}

// ─── requireAuth preHandler ───────────────────────────────────────────────────

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    return reply.status(401).send({ error: 'Not authenticated.' });
  }
}
