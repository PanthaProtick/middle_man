import type { PreparationQueryPreview } from './types';
import { requestJson } from './api';

export async function fetchPreparationPreview(
  params: { cursor?: string; limit?: number } = {},
  token?: string,
): Promise<PreparationQueryPreview> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString();
  return requestJson<PreparationQueryPreview>(
    `/api/seller/work-queries/preparation${suffix ? `?${suffix}` : ''}`,
    { method: 'GET' },
    token,
  );
}
