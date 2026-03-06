import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { openSession, getSession, fillSession, closeSession } from './session';
import type { Profile } from './autofill';

const fastify = Fastify({ logger: { level: 'warn' } });
const PORT = 3002;

async function start() {
  await fastify.register(fastifyCors, { origin: true });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', port: PORT }));

  // POST /sessions  — open browser + navigate to URL
  fastify.post<{ Body: { sessionId: number; url: string; browser?: string } }>('/sessions', async (request, reply) => {
    const { sessionId, url, browser } = request.body;
    if (!sessionId || !url) {
      return reply.status(400).send({ error: 'sessionId and url are required.' });
    }

    // Open asynchronously; status polled via GET /sessions/:id
    openSession(sessionId, url, browser ?? 'chromium').catch((err: unknown) => {
      console.error(`[runner] openSession error:`, err);
    });

    reply.status(202).send({ sessionId, status: 'opening' });
  });

  // GET /sessions/:id  — get current status + detected fields
  fastify.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const state = getSession(id);
    if (!state) return reply.status(404).send({ error: 'Session not found.' });

    reply.send({
      sessionId: state.id,
      status: state.status,
      browser: state.browser,
      url: state.page?.url() ?? state.url,
      detectedFields: state.detectedFields.map((f) => f.label),
      detectedFieldCount: state.detectedFields.length,
      fillResult: state.fillResult,
      errorMsg: state.errorMsg,
      lastUpdated: state.lastUpdated,
      stepCount: state.stepCount,
    });
  });

  // POST /sessions/:id/fill  — autofill form using profile
  fastify.post<{ Params: { id: string }; Body: { profile: Profile } }>('/sessions/:id/fill', async (request, reply) => {
    const id = Number(request.params.id);
    const { profile } = request.body;

    if (!profile) return reply.status(400).send({ error: 'profile is required.' });

    const state = getSession(id);
    if (!state) return reply.status(404).send({ error: 'Session not found.' });
    if (state.status !== 'form_detected') {
      return reply.status(409).send({
        error: `Cannot fill: session is in '${state.status}' state. Wait for 'form_detected' first.`,
      });
    }

    try {
      const result = await fillSession(id, profile);
      reply.send(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: msg });
    }
  });

  // DELETE /sessions/:id  — close browser tab
  fastify.delete<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    await closeSession(Number(request.params.id));
    reply.send({ closed: true });
  });

  await fastify.listen({ port: PORT, host: '127.0.0.1' });
  console.log(`\n  Runner ready at http://localhost:${PORT}\n`);
  console.log('  Waiting for apply sessions from the server…\n');
}

start().catch((err) => {
  console.error('[runner] startup failed:', err);
  process.exit(1);
});
