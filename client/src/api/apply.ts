import type { ApplySession, FillResult } from '../types';

const API = '/api';

export async function startApplySession(jobId: number): Promise<ApplySession> {
  const res = await fetch(`${API}/apply/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `Failed to start session: ${res.statusText}`);
  }
  return res.json() as Promise<ApplySession>;
}

export async function fetchApplySession(sessionId: number): Promise<ApplySession> {
  const res = await fetch(`${API}/apply/session/${sessionId}`);
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.statusText}`);
  return res.json() as Promise<ApplySession>;
}

export interface AutofillResponse {
  session: ApplySession;
  fillResult: FillResult;
}

export async function triggerAutofill(sessionId: number): Promise<AutofillResponse> {
  const res = await fetch(`${API}/apply/session/${sessionId}/autofill`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `Autofill failed: ${res.statusText}`);
  }
  return res.json() as Promise<AutofillResponse>;
}
