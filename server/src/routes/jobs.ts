import { FastifyInstance } from 'fastify';
import db from '../db/index';

interface JobRow {
  id: number;
  source: string;
  url: string;
  company: string;
  title: string;
  location: string;
  work_model: string;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  active_flag: number;
  applied_flag: number;
  applied_at: string | null;
  notes: string | null;
}

function toJob(row: JobRow) {
  return {
    ...row,
    active_flag: Boolean(row.active_flag),
    applied_flag: Boolean(row.applied_flag),
  };
}

interface JobsQuery {
  search?: string;
  postedAge?: string;
  workModel?: string;
  location?: string;
  company?: string;
  source?: string;
  activeOnly?: string;
  appliedOnly?: string;
  sortBy?: string;
}

interface CreateJobBody {
  source: string;
  url: string;
  company: string;
  title: string;
  location?: string;
  work_model?: string;
  posted_at?: string;
}

interface UpdateJobBody {
  notes?: string;
  active_flag?: boolean;
}

export async function jobRoutes(fastify: FastifyInstance) {
  // GET /api/jobs
  fastify.get<{ Querystring: JobsQuery }>('/jobs', (request, reply) => {
    const { search, postedAge, workModel, location, company, source, activeOnly, appliedOnly, sortBy } = request.query;

    let query = 'SELECT * FROM job_postings WHERE 1=1';
    const params: (string | number)[] = [];

    // Active-only filter (default true unless explicitly false)
    if (activeOnly !== 'false') {
      query += ' AND active_flag = 1';
    }

    // Applied-only filter for Current Jobs page
    if (appliedOnly === 'true') {
      query += ' AND applied_flag = 1';
    }

    if (search) {
      const term = `%${search}%`;
      query += ' AND (company LIKE ? OR title LIKE ? OR location LIKE ?)';
      params.push(term, term, term);
    }

    if (workModel) {
      query += ' AND work_model = ?';
      params.push(workModel);
    }

    if (location) {
      query += ' AND location LIKE ?';
      params.push(`%${location}%`);
    }

    if (company) {
      query += ' AND company LIKE ?';
      params.push(`%${company}%`);
    }

    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }

    if (postedAge) {
      const dayMap: Record<string, number> = { '1d': 1, '3d': 3, '1w': 7, '1m': 30 };
      const days = dayMap[postedAge];
      if (days) {
        query += ` AND COALESCE(posted_at, first_seen_at) >= datetime('now', ?)`;
        params.push(`-${days} days`);
      }
    }

    switch (sortBy) {
      case 'newest_discovered':
        query += ' ORDER BY first_seen_at DESC';
        break;
      case 'company_az':
        query += ' ORDER BY company ASC, title ASC';
        break;
      default: // newest_posted
        query += " ORDER BY COALESCE(posted_at, first_seen_at) DESC";
    }

    const jobs = (db.prepare(query).all(...params) as unknown as JobRow[]).map(toJob);
    reply.send(jobs);
  });

  // POST /api/jobs — create a new job (manual entry)
  fastify.post<{ Body: CreateJobBody }>('/jobs', (request, reply) => {
    const { source, url, company, title, location, work_model, posted_at } = request.body;
    const now = new Date().toISOString();

    try {
      const result = db.prepare(`
        INSERT INTO job_postings (source, url, company, title, location, work_model, posted_at, first_seen_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(source, url, company, title, location ?? '', work_model ?? 'Remote', posted_at ?? null, now, now);

      const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(Number(result.lastInsertRowid)) as unknown as JobRow;
      reply.status(201).send(toJob(job));
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException & { code?: string };
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        reply.status(409).send({ error: 'A job with that URL already exists.' });
      } else {
        throw err;
      }
    }
  });

  // POST /api/jobs/:id/mark-applied
  fastify.post<{ Params: { id: string } }>('/jobs/:id/mark-applied', (request, reply) => {
    const { id } = request.params;
    const now = new Date().toISOString();

    const result = db.prepare(`
      UPDATE job_postings SET applied_flag = 1, applied_at = ?, last_seen_at = ? WHERE id = ?
    `).run(now, now, id);

    if (Number(result.changes) === 0) {
      reply.status(404).send({ error: 'Job not found.' });
      return;
    }

    const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(id) as unknown as JobRow;
    reply.send(toJob(job));
  });

  // PATCH /api/jobs/:id — update notes or active_flag
  fastify.patch<{ Params: { id: string }; Body: UpdateJobBody }>('/jobs/:id', (request, reply) => {
    const { id } = request.params;
    const body = request.body;
    const now = new Date().toISOString();

    const setClauses: string[] = ['last_seen_at = ?'];
    const params: (string | number)[] = [now];

    if (body.notes !== undefined) {
      setClauses.push('notes = ?');
      params.push(body.notes);
    }

    if (body.active_flag !== undefined) {
      setClauses.push('active_flag = ?');
      params.push(body.active_flag ? 1 : 0);
    }

    params.push(id);

    const result = db.prepare(`UPDATE job_postings SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

    if (Number(result.changes) === 0) {
      reply.status(404).send({ error: 'Job not found.' });
      return;
    }

    const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(id) as unknown as JobRow;
    reply.send(toJob(job));
  });
}
