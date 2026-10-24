import type { BuyerSubmissionInput, EvidenceUploadResponse, PublicOrder } from './types';

export interface ApiError {
  code: string;
  message: string;
  fields?: Array<{
    field: string;
    code: string;
    message: string;
  }>;
}

export class BuyerApiError extends Error {
  code: string;
  fields?: ApiError['fields'];
  statusCode: number;

  constructor(statusCode: number, error: ApiError) {
    super(error.message);
    this.name = 'BuyerApiError';
    this.statusCode = statusCode;
    this.code = error.code;
    this.fields = error.fields;
  }
}

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let errBody: { error?: ApiError; detail?: string } = {};
    try {
      errBody = await res.json();
    } catch {
      throw new BuyerApiError(res.status, {
        code: `HTTP_${res.status}`,
        message: `Request failed with status ${res.status}`,
      });
    }
    if (errBody.error) {
      throw new BuyerApiError(res.status, errBody.error);
    }
    throw new BuyerApiError(res.status, {
      code: `HTTP_${res.status}`,
      message: typeof errBody.detail === 'string' ? errBody.detail : `Request failed with status ${res.status}`,
    });
  }
  return res.json();
}

export async function fetchPublicOrder(portalToken: string): Promise<PublicOrder> {
  return requestJson<PublicOrder>(`/api/public/orders/${encodeURIComponent(portalToken)}`, {
    method: 'GET',
  });
}

export async function submitBuyerDetails(
  portalToken: string,
  payload: BuyerSubmissionInput,
  idempotencyKey: string,
): Promise<PublicOrder> {
  return requestJson<PublicOrder>(
    `/api/public/orders/${encodeURIComponent(portalToken)}/submission`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    idempotencyKey,
  );
}

export async function uploadBuyerEvidence(
  portalToken: string,
  file: File,
  idempotencyKey?: string,
): Promise<EvidenceUploadResponse> {
  const key = idempotencyKey || crypto.randomUUID();
  const headers: Record<string, string> = {
    'Content-Type': file.type || 'image/jpeg',
    'Idempotency-Key': key,
  };

  const res = await fetch(`/api/public/orders/${encodeURIComponent(portalToken)}/evidence`, {
    method: 'POST',
    headers,
    body: file,
  });

  if (!res.ok) {
    let errBody: { error?: ApiError; detail?: string } = {};
    try {
      errBody = await res.json();
    } catch {
      throw new BuyerApiError(res.status, {
        code: `HTTP_${res.status}`,
        message: `Upload failed with status ${res.status}`,
      });
    }
    if (errBody.error) {
      throw new BuyerApiError(res.status, errBody.error);
    }
    throw new BuyerApiError(res.status, {
      code: `HTTP_${res.status}`,
      message: typeof errBody.detail === 'string' ? errBody.detail : `Upload failed with status ${res.status}`,
    });
  }
  return res.json();
}

export function formatBDT(minor: number): string {
  const bdt = minor / 100;
  return `৳${bdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseClaimedAmount(raw: string): number {
  const value = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Enter a positive BDT amount with at most two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Payment amount is outside the supported range.');
  return Number(minor);
}
