import type { JobPosting, FilterState } from '../types';
import { API, apiFetch } from './client';

export async function fetchJobs(filters: Partial<FilterState>): Promise<JobPosting[]> {
  const params = new URLSearchParams();
  if (filters.search)    params.set('search', filters.search);
  if (filters.postedAge) params.set('postedAge', filters.postedAge);
  if (filters.workModel) params.set('workModel', filters.workModel);
  if (filters.location)  params.set('location', filters.location);
  if (filters.company)   params.set('company', filters.company);
  if (filters.source)    params.set('source', filters.source);
  if (filters.sortBy)    params.set('sortBy', filters.sortBy);
  params.set('activeOnly', String(filters.activeOnly ?? true));

  const res = await apiFetch(`${API}/jobs?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.statusText}`);
  return res.json() as Promise<JobPosting[]>;
}

export async function fetchAppliedJobs(): Promise<JobPosting[]> {
  const params = new URLSearchParams({ appliedOnly: 'true', activeOnly: 'false' });
  const res = await apiFetch(`${API}/jobs?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch applied jobs: ${res.statusText}`);
  return res.json() as Promise<JobPosting[]>;
}

export async function markApplied(id: number): Promise<JobPosting> {
  const res = await apiFetch(`${API}/jobs/${id}/mark-applied`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to mark applied: ${res.statusText}`);
  return res.json() as Promise<JobPosting>;
}

export async function updateJob(
  id: number,
  updates: { notes?: string; active_flag?: boolean },
): Promise<JobPosting> {
  const res = await apiFetch(`${API}/jobs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update job: ${res.statusText}`);
  return res.json() as Promise<JobPosting>;
}
