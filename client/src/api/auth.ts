import { API, apiFetch } from './client';

export interface AuthUser {
  userId: number;
  username: string;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await apiFetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? 'Login failed');
  }
  const data = await res.json() as { user: AuthUser };
  return data.user;
}

export async function signup(username: string, password: string): Promise<AuthUser> {
  const res = await apiFetch(`${API}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? 'Signup failed');
  }
  const data = await res.json() as { user: AuthUser };
  return data.user;
}

export async function logout(): Promise<void> {
  await apiFetch(`${API}/auth/logout`, { method: 'POST' });
}

export async function getMe(): Promise<AuthUser | null> {
  const res = await apiFetch(`${API}/auth/me`);
  if (!res.ok) return null;
  const data = await res.json() as { user: AuthUser };
  return data.user;
}
