import { FastifyInstance } from 'fastify';
import { runSync, getLastSyncRun, getSyncStatus } from '../sync/syncEngine';

export async function syncRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/sync
   * Triggers a full sync across all enabled source adapters.
   * Waits for completion and returns a structured summary.
   */
  fastify.post('/sync', async (request, reply) => {
    if (getSyncStatus()) {
      return reply.status(409).send({ error: 'A sync is already in progress. Try again shortly.' });
    }

    try {
      const result = await runSync();
      reply.send(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      fastify.log.error(`Sync failed: ${msg}`);
      reply.status(500).send({ error: `Sync failed: ${msg}` });
    }
  });

  /**
   * GET /api/sync/status
   * Returns the most recent completed sync run.
   */
  fastify.get('/sync/status', (_request, reply) => {
    const run = getLastSyncRun();
    if (!run) {
      return reply.send({ lastRun: null, isSyncing: getSyncStatus() });
    }

    const totals = run.totals_json ? JSON.parse(run.totals_json) : null;
    reply.send({
      lastRun: {
        id: run.id,
        startedAt: run.started_at,
        finishedAt: run.finished_at,
        status: run.status,
        totals,
      },
      isSyncing: getSyncStatus(),
    });
  });
}
