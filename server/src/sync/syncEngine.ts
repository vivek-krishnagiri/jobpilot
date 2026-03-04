import db from '../db/index';
import type { SourceAdapter, SourceResult, SyncRunResult, ParsedJob } from './types';
import { canonicalizeUrl } from './urlUtils';
import { simplifyJobsAdapter, jobrightAdapter } from './adapters/GitHubReadmeAdapter';

// ─── Registered adapters ──────────────────────────────────────────────────────

const ADAPTERS: SourceAdapter[] = [simplifyJobsAdapter, jobrightAdapter];

// ─── Concurrency guard ────────────────────────────────────────────────────────

let isSyncing = false;

export function getSyncStatus(): boolean {
  return isSyncing;
}

// ─── Upsert a single parsed job ───────────────────────────────────────────────

function upsertJob(
  job: ParsedJob,
  sourceKey: string,
  seenUrls: Set<string>,
): 'inserted' | 'updated' | 'reactivated' | 'skipped' {
  const url = canonicalizeUrl(job.url);

  if (seenUrls.has(url)) return 'skipped';
  seenUrls.add(url);

  const existing = db
    .prepare('SELECT id, active_flag FROM job_postings WHERE url = ?')
    .get(url) as { id: number; active_flag: number } | undefined;

  const now = new Date().toISOString();

  if (existing) {
    const wasInactive = existing.active_flag === 0;
    db.prepare(`
      UPDATE job_postings
      SET last_seen_at = ?, active_flag = 1
      WHERE url = ?
    `).run(now, url);
    return wasInactive ? 'reactivated' : 'updated';
  }

  db.prepare(`
    INSERT INTO job_postings
      (source, url, company, title, location, work_model, posted_at, first_seen_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sourceKey,
    url,
    job.company,
    job.title,
    job.location,
    job.work_model,
    job.posted_at ?? null,
    now,
    now,
  );

  return 'inserted';
}

// ─── Deactivate jobs from this source that disappeared from the latest fetch ──

function deactivateStale(sourceKey: string, seenUrls: Set<string>): number {
  if (seenUrls.size === 0) {
    // Safety: if we saw 0 jobs (parse failure etc.), do NOT mass-deactivate
    return 0;
  }

  // Fetch all currently-active job URLs from this source
  const active = db
    .prepare('SELECT url FROM job_postings WHERE source = ? AND active_flag = 1')
    .all(sourceKey) as { url: string }[];

  const stale = active.map((r) => r.url).filter((u) => !seenUrls.has(u));

  if (stale.length === 0) return 0;

  const now = new Date().toISOString();
  let total = 0;

  // Batch by 100 to stay within SQLite bind-param limits
  for (let i = 0; i < stale.length; i += 100) {
    const batch = stale.slice(i, i + 100);
    const placeholders = batch.map(() => '?').join(', ');
    const result = db
      .prepare(
        `UPDATE job_postings
         SET active_flag = 0, last_seen_at = ?
         WHERE source = ? AND url IN (${placeholders})`,
      )
      .run(now, sourceKey, ...batch);
    total += Number(result.changes);
  }

  return total;
}

// ─── Main sync orchestrator ───────────────────────────────────────────────────

export async function runSync(): Promise<SyncRunResult> {
  if (isSyncing) {
    throw new Error('A sync is already in progress.');
  }
  isSyncing = true;

  const startedAt = new Date().toISOString();
  const runRow = db
    .prepare("INSERT INTO sync_runs (started_at, status) VALUES (?, 'running')")
    .run(startedAt);
  const runId = Number(runRow.lastInsertRowid);

  const sourceResults: SourceResult[] = [];
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalReactivated = 0;
  let totalDeactivated = 0;

  try {
    for (const adapter of ADAPTERS) {
      const result: SourceResult = {
        source: adapter.sourceKey,
        fetched: 0,
        inserted: 0,
        updated: 0,
        reactivated: 0,
        deactivated: 0,
        errors: [],
      };

      try {
        const jobs = await adapter.fetchAndParse();
        result.fetched = jobs.length;
        console.log(`[sync] source=${adapter.sourceKey} fetched_rows=${jobs.length}`);

        const seenUrls = new Set<string>();

        for (const job of jobs) {
          try {
            const outcome = upsertJob(job, adapter.sourceKey, seenUrls);
            if (outcome === 'inserted')   result.inserted++;
            else if (outcome === 'updated')    result.updated++;
            else if (outcome === 'reactivated') result.reactivated++;
            // 'skipped' = duplicate within this run — intentionally not counted
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(`upsert error: ${msg}`);
          }
        }

        result.deactivated = deactivateStale(adapter.sourceKey, seenUrls);

        console.log(
          `[sync] source=${adapter.sourceKey}` +
          ` inserted=${result.inserted} updated=${result.updated}` +
          ` reactivated=${result.reactivated} deactivated=${result.deactivated}` +
          (result.errors.length ? ` errors=${result.errors.length}` : ''),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[sync] source=${adapter.sourceKey} FAILED: ${msg}`);
        result.errors.push(msg);
      }

      sourceResults.push(result);
      totalInserted    += result.inserted;
      totalUpdated     += result.updated;
      totalReactivated += result.reactivated;
      totalDeactivated += result.deactivated;
    }
  } finally {
    isSyncing = false;
  }

  const finishedAt = new Date().toISOString();
  const totals = { sources: sourceResults, totalInserted, totalUpdated, totalReactivated, totalDeactivated };

  db.prepare(`
    UPDATE sync_runs
    SET finished_at = ?, status = 'success', totals_json = ?
    WHERE id = ?
  `).run(finishedAt, JSON.stringify(totals), runId);

  return {
    runId,
    startedAt,
    finishedAt,
    sources: sourceResults,
    totalInserted,
    totalUpdated,
    totalReactivated,
    totalDeactivated,
    allCaughtUp: totalInserted + totalUpdated + totalReactivated === 0,
  };
}

// ─── Last sync run lookup ─────────────────────────────────────────────────────

export interface SyncRunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  totals_json: string | null;
  error_msg: string | null;
}

export function getLastSyncRun(): SyncRunRow | null {
  return (db
    .prepare("SELECT * FROM sync_runs WHERE status != 'running' ORDER BY id DESC LIMIT 1")
    .get() as SyncRunRow | undefined) ?? null;
}
