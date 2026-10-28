import type { CreationMessage } from '../locale/orderCreationCopy';
import { SellerApiError } from './api';

const fields: Record<string, { name: string; message: CreationMessage }> = {
  product_name: { name: 'productName', message: 'productLimit' },
  total_minor: { name: 'totalBdt', message: 'totalInvalid' },
  required_advance_minor: { name: 'advanceBdt', message: 'advanceInvalid' },
  parcel_weight_grams: { name: 'parcelWeightKg', message: 'weightRange' },
  parcel_quantity: { name: 'parcelQuantity', message: 'quantityRange' },
  payment_account_id: { name: 'paymentAccountId', message: 'accountRequired' },
};

export function orderCreationError(cause: unknown): { code: string; message: CreationMessage; name?: string } {
  const code = cause instanceof SellerApiError ? cause.code : 'UNKNOWN';
  if (cause instanceof SellerApiError && code === 'VALIDATION_ERROR') {
    // The first recognized field follows the rendered form order, regardless of server ordering.
    const field = Object.keys(fields).find(key => cause.fields?.some(item => item.field === key));
    return { code, message: field ? fields[field].message : 'invalid', name: field ? fields[field].name : undefined };
  }
  const messages: Record<string, CreationMessage> = {
    IDEMPOTENCY_KEY_REUSED: 'conflict', PAYMENT_ACCOUNT_INACTIVE: 'inactive', NOT_FOUND: 'inactive',
    UNAUTHORIZED: 'session', AUTH_UNAVAILABLE: 'session', DURABLE_STORAGE_UNAVAILABLE: 'storage',
  };
  return { code, message: Object.hasOwn(messages, code) ? messages[code] : 'failed' };
}
