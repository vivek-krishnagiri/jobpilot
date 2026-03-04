import type { FastifyInstance } from 'fastify';
import db from '../db/index';

const RUNNER_URL = 'http://localhost:3002';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApplySessionRow {
  id: number;
  job_id: number;
  job_url: string;
  status: string;
  browser: string;
  detected_fields_json: string | null;
  fill_result_json: string | null;
  error_msg: string | null;
  created_at: string;
  updated_at: string;
}

interface JobRow {
  id: number;
  url: string;
}

// ─── Helper: call runner with timeout ────────────────────────────────────────

async function runnerFetch(endpoint: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(`${RUNNER_URL}${endpoint}`, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Helper: update session in DB ────────────────────────────────────────────

function updateSession(id: number, fields: Partial<Record<string, unknown>>) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClauses = [...keys.map((k) => `${k} = ?`), 'updated_at = ?'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.prepare(`UPDATE apply_sessions SET ${setClauses.join(', ')} WHERE id = ?`)
    .run(...([...Object.values(fields), new Date().toISOString(), id] as any[]));
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function applyRoutes(fastify: FastifyInstance) {

  // POST /api/apply/session  — start a new apply session
  fastify.post<{ Body: { jobId: number } }>('/apply/session', async (request, reply) => {
    const { jobId } = request.body;
    if (!jobId) return reply.status(400).send({ error: 'jobId is required.' });

    const job = db.prepare('SELECT id, url FROM job_postings WHERE id = ?').get(jobId) as unknown as JobRow | undefined;
    if (!job) return reply.status(404).send({ error: 'Job not found.' });

    // Read preferred browser from profile (default chromium)
    const profileRow = db
      .prepare('SELECT preferred_browser FROM applicant_profile WHERE id = 1')
      .get() as { preferred_browser?: string } | undefined;
    const browser = profileRow?.preferred_browser ?? 'chromium';

    // Insert session record
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO apply_sessions (job_id, job_url, status, browser, created_at, updated_at)
      VALUES (?, ?, 'created', ?, ?, ?)
    `).run(job.id, job.url, browser, now, now);

    const sessionId = Number(result.lastInsertRowid);

    // Ping runner to open the page (fire-and-forget; status polled separately)
    updateSession(sessionId, { status: 'opening' });

    runnerFetch('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, url: job.url, browser }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          updateSession(sessionId, { status: 'error', error_msg: body.error ?? 'Runner rejected session' });
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        const friendly = msg.includes('ECONNREFUSED') || msg.includes('aborted')
          ? 'Runner is not running. Start it with: pnpm --filter runner dev'
          : msg;
        updateSession(sessionId, { status: 'error', error_msg: friendly });
      });

    const session = db.prepare('SELECT * FROM apply_sessions WHERE id = ?').get(sessionId) as unknown as ApplySessionRow;
    reply.status(201).send(session);
  });

  // GET /api/apply/session/:id  — poll session status
  fastify.get<{ Params: { id: string } }>('/apply/session/:id', async (request, reply) => {
    const session = db
      .prepare('SELECT * FROM apply_sessions WHERE id = ?')
      .get(request.params.id) as unknown as ApplySessionRow | undefined;

    if (!session) return reply.status(404).send({ error: 'Session not found.' });

    // While the browser is open and watching, proxy runner for fresh status
    if (session.status === 'opening' || session.status === 'open') {
      try {
        const res = await runnerFetch(`/sessions/${session.id}`);
        if (res.ok) {
          const data = await res.json() as { status: string; detectedFields?: string[] };
          if (data.status !== session.status) {
            updateSession(session.id, {
              status: data.status,
              detected_fields_json: data.detectedFields ? JSON.stringify(data.detectedFields) : null,
            });
          }
        }
      } catch { /* runner may not be ready yet, ignore */ }
    }

    reply.send(db.prepare('SELECT * FROM apply_sessions WHERE id = ?').get(session.id) as unknown as ApplySessionRow);
  });

  // POST /api/apply/session/:id/autofill  — trigger form fill
  fastify.post<{ Params: { id: string } }>('/apply/session/:id/autofill', async (request, reply) => {
    const session = db
      .prepare('SELECT * FROM apply_sessions WHERE id = ?')
      .get(request.params.id) as unknown as ApplySessionRow | undefined;

    if (!session) return reply.status(404).send({ error: 'Session not found.' });
    if (session.status === 'error') return reply.status(409).send({ error: `Session in error state: ${session.error_msg}` });

    // Load profile
    const profile = db.prepare('SELECT * FROM applicant_profile WHERE id = 1').get() as unknown as Record<string, unknown> | undefined;
    if (!profile) return reply.status(400).send({ error: 'No profile saved. Please create your profile first.' });

    updateSession(session.id, { status: 'filling' });

    try {
      const res = await runnerFetch(`/sessions/${session.id}/fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        const msg = body.error ?? 'Fill failed';
        updateSession(session.id, { status: 'error', error_msg: msg });
        return reply.status(502).send({ error: msg });
      }

      const fillResult = await res.json() as { filled: string[]; skipped: string[]; total: number };
      updateSession(session.id, {
        status: 'filled',
        fill_result_json: JSON.stringify(fillResult),
      });

      reply.send({
        session: db.prepare('SELECT * FROM apply_sessions WHERE id = ?').get(session.id) as unknown as ApplySessionRow,
        fillResult,
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updateSession(session.id, { status: 'error', error_msg: msg });
      reply.status(502).send({ error: msg });
    }
  });
}
