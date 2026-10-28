import { orderCreationCopy } from '../locale/orderCreationCopy';
import { asciiDigits } from './orderNumbers';
export type ParcelErrorCode = 'weightPrecision' | 'weightRange' | 'quantityWhole' | 'quantityRange';
export class ParcelValidationError extends Error {
  constructor(public readonly code: ParcelErrorCode) { super(orderCreationCopy.en[code]); }
}

export const MAX_PARCEL_WEIGHT_GRAMS = 1_000_000;
export const MAX_PARCEL_QUANTITY = 10_000;

export function parseParcelWeightKg(value: string): number {
  const trimmed = asciiDigits(value).trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) {
    throw new ParcelValidationError('weightPrecision');
  }
  const [whole, fraction = ''] = trimmed.split('.');
  const grams = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
  if (grams < 1 || grams > MAX_PARCEL_WEIGHT_GRAMS) {
    throw new ParcelValidationError('weightRange');
  }
  return grams;
}

export function parseParcelQuantity(value: string): number {
  const trimmed = asciiDigits(value).trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new ParcelValidationError('quantityWhole');
  }
  const quantity = Number(trimmed);
  if (quantity < 1 || quantity > MAX_PARCEL_QUANTITY) {
    throw new ParcelValidationError('quantityRange');
  }
  return quantity;
}
