import type { SourceAdapter, ParsedJob } from '../types';
import { parseMarkdownTables, parseHtmlTables, cellText, cellUrl, cellLocation, findCol, inferWorkModel } from '../markdownParser';
import { parseDatePosted, parseAgeField, isWithinDays } from '../dateUtils';
import { canonicalizeUrl } from '../urlUtils';

export interface GitHubReadmeConfig {
  /** Human-readable name for logs */
  name: string;
  /** Used as the `source` field in job_postings */
  sourceKey: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  /** Only import jobs posted within this many days (default 30) */
  maxAgeDays?: number;
}

/**
 * Fetches a GitHub README via raw.githubusercontent.com and parses markdown
 * tables into normalized job records.
 *
 * Supports two table formats:
 *  A) SimplifyJobs  → Company | Role | Location | Application | Age
 *  B) jobright-ai   → Company | Job Title | Location | Work Model | Date Posted
 */
export class GitHubReadmeAdapter implements SourceAdapter {
  readonly name: string;
  readonly sourceKey: string;
  private cfg: GitHubReadmeConfig;

  constructor(cfg: GitHubReadmeConfig) {
    this.cfg = cfg;
    this.name = cfg.name;
    this.sourceKey = cfg.sourceKey;
  }

  async fetchAndParse(): Promise<ParsedJob[]> {
    const rawUrl = `https://raw.githubusercontent.com/${this.cfg.owner}/${this.cfg.repo}/${this.cfg.branch}/${this.cfg.path}`;
    console.log(`[sync] ${this.sourceKey} fetching ${rawUrl}`);

    const res = await fetch(rawUrl, {
      headers: { 'User-Agent': 'JobPilot/1.0 (personal job tracker)' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${rawUrl}`);
    }

    const content = await res.text();
    console.log(`[sync] ${this.sourceKey} fetched ${content.length} chars`);

    const jobs = this.parseTables(content);
    const maxAge = this.cfg.maxAgeDays ?? 30;
    const filtered = jobs.filter((j) => isWithinDays(j.posted_at, maxAge));

    console.log(
      `[sync] ${this.sourceKey} parsed_total=${jobs.length} within_${maxAge}d=${filtered.length}`,
    );

    return filtered;
  }

  private parseTables(content: string): ParsedJob[] {
    let tables = parseMarkdownTables(content);

    if (tables.length === 0) {
      // Fall back to HTML tables (some READMEs use <table> instead of markdown pipes)
      tables = parseHtmlTables(content);
    }

    if (tables.length === 0) {
      console.warn(`[sync] ${this.sourceKey} — no tables found (markdown or HTML). First 20 lines:`);
      content.split('\n').slice(0, 20).forEach((l, i) => console.warn(`  ${i + 1}: ${l}`));
      return [];
    }

    const jobs: ParsedJob[] = [];
    let lastCompany = '';

    for (const table of tables) {
      const h = table.headers;

      // Column indices — try many possible header name variants
      const colCompany  = findCol(h, 'company', 'companies');
      const colTitle    = findCol(h, 'role', 'job title', 'title', 'position', 'job');
      const colLocation = findCol(h, 'location', 'locations');
      const colApp      = findCol(h, 'application', 'application/link', 'link', 'apply');
      const colAge      = findCol(h, 'age', 'days');
      const colDate     = findCol(h, 'date posted', 'date', 'posted');
      const colModel    = findCol(h, 'work model', 'work_model', 'type', 'remote');

      // Need at minimum company + title
      if (colCompany === -1 || colTitle === -1) continue;

      for (const row of table.rows) {
        const get = (idx: number) => (idx >= 0 && idx < row.length ? row[idx] : '');

        const companyCell  = get(colCompany);
        const titleCell    = get(colTitle);
        const locationCell = get(colLocation);
        const appCell      = colApp >= 0 ? get(colApp) : '';
        const ageCell      = colAge >= 0 ? get(colAge) : '';
        const dateCell     = colDate >= 0 ? get(colDate) : '';
        const modelCell    = colModel >= 0 ? get(colModel) : '';

        // Handle "↳" continuation rows — inherit previous company
        const companyText = cellText(companyCell);
        const company = companyText === '↳' || companyText === '' ? lastCompany : companyText;
        if (company) lastCompany = company;
        if (!company) continue;

        const title = cellText(titleCell);
        if (!title) continue;

        // URL: prefer dedicated Application column, then title link, then company link
        let rawUrl =
          (appCell ? cellUrl(appCell) : null) ??
          cellUrl(titleCell) ??
          cellUrl(companyCell);

        // Skip rows with no usable URL (e.g. closed positions marked 🔒)
        if (!rawUrl) continue;

        rawUrl = canonicalizeUrl(rawUrl);

        // Location
        const location = cellLocation(locationCell) || 'Not specified';

        // Work model — check explicit column first, then infer from location
        const work_model = inferWorkModel(modelCell || null, location);

        // Date — prefer explicit "Date Posted" column, then Age field
        let posted_at: string | null = null;
        if (dateCell) {
          posted_at = parseDatePosted(cellText(dateCell));
        }
        if (!posted_at && ageCell) {
          posted_at = parseAgeField(cellText(ageCell));
        }

        jobs.push({ company, title, location, url: rawUrl, posted_at, work_model });
      }
    }

    return jobs;
  }
}

// ─── Pre-built adapter instances ───────────────────────────────────────────────

export const simplifyJobsAdapter = new GitHubReadmeAdapter({
  name: 'SimplifyJobs New Grad Positions',
  sourceKey: 'SimplifyJobs',
  owner: 'SimplifyJobs',
  repo: 'New-Grad-Positions',
  branch: 'dev',
  path: 'README.md',
  maxAgeDays: 30,
});

export const jobrightAdapter = new GitHubReadmeAdapter({
  name: 'Jobright 2026 SWE New Grad',
  sourceKey: 'Jobright',
  owner: 'jobright-ai',
  repo: '2026-Software-Engineer-New-Grad',
  branch: 'master',
  path: 'README.md',
  maxAgeDays: 30,
});
