import type { ApplicantProfile } from '../types';
import { API, apiFetch } from './client';

export async function fetchProfile(): Promise<ApplicantProfile> {
  const res = await apiFetch(`${API}/profile`);
  if (!res.ok) throw new Error(`Failed to load profile: ${res.statusText}`);
  return res.json() as Promise<ApplicantProfile>;
}

export async function saveProfile(updates: Partial<ApplicantProfile>): Promise<ApplicantProfile> {
  const res = await apiFetch(`${API}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to save profile: ${res.statusText}`);
  return res.json() as Promise<ApplicantProfile>;
}

export interface ResumeUploadResult {
  profile: ApplicantProfile;
  extracted: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    linkedin_url?: string;
    website_url?: string;
  };
}

export async function uploadResume(file: File): Promise<ResumeUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetch(`${API}/profile/resume`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `Upload failed: ${res.statusText}`);
  }
  return res.json() as Promise<ResumeUploadResult>;
}

export async function uploadCoverLetter(file: File): Promise<{ profile: ApplicantProfile }> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetch(`${API}/profile/cover-letter`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `Upload failed: ${res.statusText}`);
  }
  return res.json() as Promise<{ profile: ApplicantProfile }>;
}
