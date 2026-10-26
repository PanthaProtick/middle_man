export const MAX_PARCEL_WEIGHT_GRAMS = 1_000_000;
export const MAX_PARCEL_QUANTITY = 10_000;

export function parseParcelWeightKg(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) {
    throw new Error('Parcel weight must have up to 3 decimal places');
  }
  const [whole, fraction = ''] = trimmed.split('.');
  const grams = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
  if (grams < 1 || grams > MAX_PARCEL_WEIGHT_GRAMS) {
    throw new Error('Parcel weight must be between 0.001 kg and 1000 kg');
  }
  return grams;
}

export function parseParcelQuantity(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error('Parcel quantity must be a whole number');
  }
  const quantity = Number(trimmed);
  if (quantity < 1 || quantity > MAX_PARCEL_QUANTITY) {
    throw new Error('Parcel quantity must be between 1 and 10000');
  }
  return quantity;
}
