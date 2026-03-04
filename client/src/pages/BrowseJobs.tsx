import { useState, useMemo, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import type { FilterState } from '../types';
import { DEFAULT_FILTERS } from '../types';
import { useJobs } from '../hooks/useJobs';
import { useDebounce } from '../hooks/useDebounce';
import { markApplied } from '../api/jobs';
import { triggerSync, fetchSyncStatus } from '../api/sync';
import type { SyncResult, SyncStatus } from '../api/sync';
import FilterPanel from '../components/FilterPanel';
import JobTable from '../components/JobTable';
import EmptyState from '../components/EmptyState';
import { relativeDate } from '../utils/date';

// ─── Toast notification ───────────────────────────────────────────────────────

type ToastKind = 'success' | 'info' | 'error';
interface Toast { kind: ToastKind; message: string }

function ToastBanner({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const styles: Record<ToastKind, string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    error:   'bg-red-50 border-red-200 text-red-800',
  };
  return (
    <div className={clsx('flex items-center justify-between px-4 py-2.5 border-b text-sm font-medium shrink-0', styles[toast.kind])}>
      <span>{toast.message}</span>
      <button onClick={onDismiss} className="ml-4 opacity-60 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  );
}

// ─── BrowseJobs page ──────────────────────────────────────────────────────────

export default function BrowseJobs() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  const debouncedSearch   = useDebounce(filters.search, 300);
  const debouncedLocation = useDebounce(filters.location, 300);
  const debouncedCompany  = useDebounce(filters.company, 300);

  const apiFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch, location: debouncedLocation, company: debouncedCompany }),
    [filters, debouncedSearch, debouncedLocation, debouncedCompany],
  );

  const { jobs, loading, error, refetch } = useJobs(apiFilters);

  const loadSyncStatus = useCallback(() => {
    fetchSyncStatus().then(setSyncStatus).catch(() => {/* silent */});
  }, []);

  useEffect(() => { loadSyncStatus(); }, [loadSyncStatus]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const hasActiveFilters =
    !!filters.search || !!filters.postedAge || !!filters.workModel ||
    !!filters.location || !!filters.company || !!filters.source || !filters.activeOnly;

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const handleMarkApplied = async (id: number) => {
    await markApplied(id);
    refetch();
  };

  const handleSync = async () => {
    setSyncing(true);
    setToast(null);
    try {
      const result: SyncResult = await triggerSync();
      const { totalInserted, totalUpdated, totalReactivated, totalDeactivated, allCaughtUp } = result;

      if (allCaughtUp) {
        setToast({ kind: 'info', message: "Good job, you're all caught up. No new jobs found." });
      } else {
        const parts: string[] = [];
        if (totalInserted)    parts.push(`${totalInserted} new`);
        if (totalUpdated)     parts.push(`${totalUpdated} updated`);
        if (totalReactivated) parts.push(`${totalReactivated} reactivated`);
        if (totalDeactivated) parts.push(`${totalDeactivated} deactivated`);
        setToast({ kind: 'success', message: `Synced: ${parts.join(', ')}.` });
      }

      refetch();
      loadSyncStatus();
    } catch (err: unknown) {
      setToast({ kind: 'error', message: err instanceof Error ? err.message : 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  const lastSyncedLabel = (() => {
    if (syncStatus?.isSyncing) return 'Syncing…';
    const finishedAt = syncStatus?.lastRun?.finishedAt;
    if (!finishedAt) return null;
    return `Last synced ${relativeDate(finishedAt)}`;
  })();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toast */}
      {toast && <ToastBanner toast={toast} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">Browse Jobs</h1>
          {!loading && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-full">
              {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {lastSyncedLabel && <span className="text-xs text-gray-400">{lastSyncedLabel}</span>}

          {/* Sync Jobs */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
              syncing
                ? 'border-indigo-200 bg-indigo-50 text-indigo-400 cursor-not-allowed'
                : 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700',
            )}
          >
            <svg className={clsx('w-3.5 h-3.5', syncing && 'animate-spin')} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            {syncing ? 'Syncing…' : 'Sync Jobs'}
          </button>

          {/* Refresh list */}
          <button
            onClick={refetch}
            disabled={loading}
            title="Refresh job list"
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
              loading
                ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-white'
                : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 bg-white',
            )}
          >
            <svg className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0">
        <FilterPanel filters={filters} onChange={updateFilter} onClear={clearFilters} hasActiveFilters={hasActiveFilters} />
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : jobs.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters} onClearFilters={clearFilters} onSync={handleSync} />
        ) : (
          <JobTable jobs={jobs} onMarkApplied={handleMarkApplied} />
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-2 text-gray-400">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Loading jobs…</span>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Failed to load jobs</h3>
      <p className="text-xs text-gray-500 mb-3">{message}</p>
      <button onClick={onRetry} className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">
        Try again
      </button>
    </div>
  );
}
