import { requestJson } from './api';
import type { RetentionCleanupResponse, RetentionStatusResponse } from './types';

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
