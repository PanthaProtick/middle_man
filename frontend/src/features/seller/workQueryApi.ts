import type { AttentionQueryPreview, PreparationQueryPreview } from './types';
import { requestJson } from './api';

export async function fetchPreparationPreview(
  params: { cursor?: string; limit?: number } = {},
  token?: string,
): Promise<PreparationQueryPreview> {
  return requestJson<PreparationQueryPreview>(
    `/api/seller/work-queries/preparation${querySuffix(params)}`,
    { method: 'GET' },
    token,
  );
}

export async function fetchAttentionPreview(
  params: { cursor?: string; limit?: number } = {},
  token?: string,
): Promise<AttentionQueryPreview> {
  return requestJson<AttentionQueryPreview>(
    `/api/seller/work-queries/attention${querySuffix(params)}`,
    { method: 'GET' },
    token,
  );
}

function querySuffix(params: { cursor?: string; limit?: number }): string {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
}
