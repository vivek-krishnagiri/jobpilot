export interface ParsedJob {
  company: string;
  title: string;
  location: string;
  url: string;
  posted_at: string | null;
  work_model: 'Remote' | 'Hybrid' | 'On-site';
}

export interface SourceResult {
  source: string;
  fetched: number;
  inserted: number;
  updated: number;
  reactivated: number;
  deactivated: number;
  errors: string[];
}

export interface SyncRunResult {
  runId: number;
  startedAt: string;
  finishedAt: string;
  sources: SourceResult[];
  totalInserted: number;
  totalUpdated: number;
  totalReactivated: number;
  totalDeactivated: number;
  allCaughtUp: boolean;
}

export interface SourceAdapter {
  name: string;
  sourceKey: string;
  fetchAndParse(): Promise<ParsedJob[]>;
}
