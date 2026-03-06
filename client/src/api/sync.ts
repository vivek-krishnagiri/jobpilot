import { API, apiFetch } from './client';

export interface SourceResult {
  source: string;
  fetched: number;
  inserted: number;
  updated: number;
  reactivated: number;
  deactivated: number;
  errors: string[];
}

export interface SyncResult {
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

export interface SyncStatus {
  lastRun: {
    id: number;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    totals: { totalInserted: number; totalUpdated: number; totalReactivated: number; totalDeactivated: number } | null;
  } | null;
  isSyncing: boolean;
}

export async function triggerSync(): Promise<SyncResult> {
  const res = await apiFetch(`${API}/sync`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `Sync failed: ${res.statusText}`);
  }
  return res.json() as Promise<SyncResult>;
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const res = await apiFetch(`${API}/sync/status`);
  if (!res.ok) throw new Error(`Failed to fetch sync status: ${res.statusText}`);
  return res.json() as Promise<SyncStatus>;
}
