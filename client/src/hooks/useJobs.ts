import { useState, useEffect, useCallback } from 'react';
import { fetchJobs } from '../api/jobs';
import type { JobPosting, FilterState } from '../types';

export function useJobs(filters: Partial<FilterState>) {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchJobs(filters)
      .then((data) => {
        if (!cancelled) {
          setJobs(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load jobs');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, refreshKey]);

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { jobs, loading, error, refetch };
}
