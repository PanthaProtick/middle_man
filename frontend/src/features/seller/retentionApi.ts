import type { RetentionCleanupResponse, RetentionStatusResponse } from './types';

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = (await res.json()) as { error?: { message?: string }; detail?: string };
      message = data.error?.message || data.detail || message;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export interface StructuredRetentionStatus {
  checked_at: string;
  overdue: number;
  failed: number;
  removed: number;
  standby: boolean;
}

export async function structuredRetention(token?: string, cleanup = false): Promise<StructuredRetentionStatus> {
  return requestJson<StructuredRetentionStatus>(
    `/api/seller/retention/structured${cleanup ? '/cleanup' : ''}`,
    { method: cleanup ? 'POST' : 'GET' }, token,
  );
}

export async function fetchRetentionStatus(token?: string): Promise<RetentionStatusResponse> {
  return requestJson<RetentionStatusResponse>('/api/seller/retention/status', {}, token);
}

export async function runRetentionCleanup(token?: string): Promise<RetentionCleanupResponse> {
  return requestJson<RetentionCleanupResponse>(
    '/api/seller/retention/cleanup',
    { method: 'POST' },
    token,
  );
}
