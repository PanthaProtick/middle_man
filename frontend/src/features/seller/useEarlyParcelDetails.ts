import { useState } from 'react';
import { parseParcelQuantity, parseParcelWeightKg, ParcelValidationError, type ParcelErrorCode } from './parcel';

export type ParcelErrors = Partial<Record<'weight' | 'quantity', ParcelErrorCode>>;

export function useEarlyParcelDetails() {
  const [weightKg, setWeightKg] = useState('');
  const [quantity, setQuantity] = useState('');
  const [errors, setErrors] = useState<ParcelErrors>({});
  const [validationAttempt, setValidationAttempt] = useState(0);

  function validate() {
    const nextErrors: ParcelErrors = {};
    const values: { parcel_weight_grams?: number; parcel_quantity?: number } = {};
    try {
      if (weightKg.trim()) values.parcel_weight_grams = parseParcelWeightKg(weightKg);
    } catch (cause) {
      nextErrors.weight = cause instanceof ParcelValidationError ? cause.code : 'weightRange';
    }
    try {
      if (quantity.trim()) values.parcel_quantity = parseParcelQuantity(quantity);
    } catch (cause) {
      nextErrors.quantity = cause instanceof ParcelValidationError ? cause.code : 'quantityRange';
    }
    setErrors(nextErrors);
    setValidationAttempt(current => current + 1);
    return Object.keys(nextErrors).length ? undefined : values;
  }

  return {
    weightKg, quantity, errors, validationAttempt, validate,
    onWeightChange: (value: string) => {
      setWeightKg(value);
      setErrors(current => ({ ...current, weight: undefined }));
    },
    onQuantityChange: (value: string) => {
      setQuantity(value);
      setErrors(current => ({ ...current, quantity: undefined }));
    },
  };
}
