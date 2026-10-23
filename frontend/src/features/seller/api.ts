import type {
  AccountInput,
  AccountUpdateInput,
  ApiError,
  PaymentAccount,
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

export class SellerApiError extends Error {
  code: string;
  fields?: ApiError['fields'];

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'SellerApiError';
    this.code = error.code;
    this.fields = error.fields;
  }
}

async function requestJson<T>(
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

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let errBody: { error?: ApiError; detail?: string } = {};
    try {
      errBody = await res.json();
    } catch {
      throw new SellerApiError({
        code: `HTTP_${res.status}`,
        message: `Request failed with status ${res.status}`,
      });
    }
    if (errBody.error) {
      throw new SellerApiError(errBody.error);
    }
    throw new SellerApiError({
      code: `HTTP_${res.status}`,
      message: typeof errBody.detail === 'string' ? errBody.detail : 'Request failed',
    });
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
