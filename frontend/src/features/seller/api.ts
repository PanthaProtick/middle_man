import { sellerFetch } from './sessionRequest';
import { formatBangladeshDateTime } from '../locale/format';
import type { ImportList, ImportResult } from './smsTypes';
import type {
  AccountInput,
  AccountUpdateInput,
  ApiError,
  ManualReceiptInput,
  OrderInput,
  PaymentAccount,
  ReceiptListResponse,
  ReceiptView,
  SellerOrder,
  SellerOrderListResponse,
  ShopStatus,
} from './types';

const BANGLA_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

export function canonicalizeBdPhone(raw: string): string {
  let cleaned = raw.trim();
  for (const [bangla, ascii] of Object.entries(BANGLA_DIGITS)) {
    cleaned = cleaned.replaceAll(bangla, ascii);
  }
  cleaned = cleaned.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+880')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('880')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('+88')) {
    cleaned = cleaned.slice(3);
  }

  if (!BD_PHONE_REGEX.test(cleaned)) {
    throw new Error(`Invalid Bangladeshi phone number: '${raw}'. Must be 11 digits starting with 01[3-9].`);
  }
  return cleaned;
}

export function formatBangladeshTime(isoString: string): string {
  return formatBangladeshDateTime(isoString, 'en');
}

export function parseBdtToMinor(bdtStr: string): number {
  const trimmed = bdtStr.trim();
  if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error('Amount must be a positive number with up to 2 decimal places');
  }
  const [whole, decimal = ''] = trimmed.split('.');
  const minor = BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
  if (minor <= 0n) {
    throw new Error('Amount must be greater than 0');
  }
  return Number(minor);
}

export function formatRemainingCod(order: {
  lifecycle: string;
  actual_cod_minor: number | null;
  expected_cod_minor: number;
}): string {
  const minor =
    order.lifecycle === 'confirmed' && order.actual_cod_minor !== null
      ? order.actual_cod_minor
      : order.expected_cod_minor;
  return `BDT ${(minor / 100).toLocaleString()}`;
}

export class SellerApiError extends Error {
  status: number;
  code: string;
  fields?: ApiError['fields'];

  constructor(error: ApiError, status = 0) {
    super(error.message);
    this.name = 'SellerApiError';
    this.status = status;
    this.code = error.code;
    this.fields = error.fields;
  }
}

export async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  token?: string,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const res = await sellerFetch(url, { ...options, headers }, token);
  if (!res.ok) {
    let errBody: { error?: ApiError; detail?: string } = {};
    try {
      errBody = await res.json();
    } catch {
      throw new SellerApiError({
        code: `HTTP_${res.status}`,
        message: `Request failed with status ${res.status}`,
      }, res.status);
    }
    if (errBody.error) {
      throw new SellerApiError(errBody.error, res.status);
    }
    throw new SellerApiError({
      code: `HTTP_${res.status}`,
      message: typeof errBody.detail === 'string' ? errBody.detail : 'Request failed',
    }, res.status);
  }

  return res.json() as Promise<T>;
}

export async function fetchShop(token?: string): Promise<ShopStatus> {
  return requestJson<ShopStatus>('/api/seller/shop', { method: 'GET' }, token);
}

export async function createShop(
  displayName: string,
  idempotencyKey: string,
  token?: string,
): Promise<ShopStatus> {
  return requestJson<ShopStatus>(
    '/api/seller/shop',
    {
      method: 'POST',
      body: JSON.stringify({ display_name: displayName }),
    },
    token,
    idempotencyKey,
  );
}

export async function fetchPaymentAccounts(token?: string): Promise<PaymentAccount[]> {
  return requestJson<PaymentAccount[]>('/api/seller/payment-accounts', { method: 'GET' }, token);
}

export async function createPaymentAccount(
  input: AccountInput,
  idempotencyKey: string,
  token?: string,
): Promise<PaymentAccount> {
  const canonicalNumber = canonicalizeBdPhone(input.receiving_number);
  return requestJson<PaymentAccount>(
    '/api/seller/payment-accounts',
    {
      method: 'POST',
      body: JSON.stringify({
        provider: input.provider,
        receiving_number: canonicalNumber,
        label: input.label,
      }),
    },
    token,
    idempotencyKey,
  );
}

export async function updatePaymentAccount(
  accountId: string,
  input: AccountUpdateInput,
  token?: string,
): Promise<PaymentAccount> {
  return requestJson<PaymentAccount>(
    `/api/seller/payment-accounts/${accountId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function fetchOrders(
  params: { cursor?: string; limit?: number; status?: string } = {},
  token?: string,
): Promise<SellerOrderListResponse> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  const qStr = query.toString();
  const url = `/api/seller/orders${qStr ? `?${qStr}` : ''}`;
  return requestJson<SellerOrderListResponse>(url, { method: 'GET' }, token);
}

export async function createOrder(
  input: OrderInput,
  idempotencyKey: string,
  token?: string,
): Promise<SellerOrder> {
  return requestJson<SellerOrder>(
    '/api/seller/orders',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    token,
    idempotencyKey,
  );
}

export async function fetchOrder(orderId: string, token?: string): Promise<SellerOrder> {
  return requestJson<SellerOrder>(`/api/seller/orders/${orderId}`, { method: 'GET' }, token);
}

export async function resolveOrderLink(
  portalToken: string,
  token?: string,
): Promise<{ order_id: string }> {
  return requestJson<{ order_id: string }>(
    '/api/seller/order-links/resolve',
    {
      method: 'POST',
      body: JSON.stringify({ portal_token: portalToken }),
    },
    token,
  );
}

export async function fetchTransactions(
  params: { cursor?: string; limit?: number; review?: string; used?: string; parse?: string } = {},
  token?: string,
): Promise<ReceiptListResponse> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.review) query.set('review', params.review);
  if (params.used) query.set('used', params.used);
  if (params.parse) query.set('parse', params.parse);
  const qStr = query.toString();
  const url = `/api/seller/transactions${qStr ? `?${qStr}` : ''}`;
  return requestJson<ReceiptListResponse>(url, { method: 'GET' }, token);
}

export async function recordManualTransaction(
  input: ManualReceiptInput,
  idempotencyKey?: string,
  token?: string,
): Promise<ReceiptView> {
  return requestJson<ReceiptView>(
    '/api/seller/transactions',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    token,
    idempotencyKey,
  );
}

export async function importSms(
  input: { payment_account_id: string; messages: string[] }, key: string, token?: string,
): Promise<ImportResult> {
  return requestJson<ImportResult>('/api/seller/transactions/sms-import', {
    method: 'POST', body: JSON.stringify(input),
  }, token, key);
}

export async function fetchSmsImports(cursor?: string, token?: string): Promise<ImportList> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return requestJson<ImportList>(`/api/seller/transactions/sms-imports${query}`, {}, token);
}
