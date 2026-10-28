import { useLocale } from '../locale/context';
import { orderCreationCopy } from '../locale/orderCreationCopy';
import { useEffect, useRef } from 'react';
import { MAX_PARCEL_QUANTITY, MAX_PARCEL_WEIGHT_GRAMS } from './parcel';
import type { ParcelErrors } from './useEarlyParcelDetails';

interface ParcelEarlyFieldsProps {
  weightKg: string;
  quantity: string;
  onWeightChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  disabled: boolean;
  errors: ParcelErrors;
  validationAttempt: number;
  serverField?: string | null;
  serverErrorId?: string;
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
} as const;

export function ParcelEarlyFields({
  weightKg,
  quantity,
  onWeightChange,
  onQuantityChange,
  disabled,
  errors,
  validationAttempt,
  serverField,
  serverErrorId,
}: ParcelEarlyFieldsProps) {
  const text = orderCreationCopy[useLocale().locale];
  const fieldsRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    fieldsRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [validationAttempt]);
  return (
    <fieldset ref={fieldsRef} style={{ border: 'none', padding: 0, margin: '0 0 14px' }}>
      <legend style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
        {text.parcel}
      </legend>
      <p id="parcel-early-hint" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
        {text.parcelHint}
      </p>
      <div className="form-grid-2">
        <div>
          <label htmlFor="parcel-weight-kg" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {text.weight}
          </label>
          <input
            id="parcel-weight-kg"
            type="text"
            inputMode="decimal"
            name="parcelWeightKg"
            aria-label={text.weight}
            placeholder={text.weightExample}
            min="0.001"
            max={MAX_PARCEL_WEIGHT_GRAMS / 1000}
            step="0.001"
            value={weightKg}
            onChange={(e) => onWeightChange(e.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(errors.weight) || serverField === 'parcelWeightKg'}
            aria-describedby={`parcel-early-hint${errors.weight ? ' parcel-weight-error' : ''}${serverField === 'parcelWeightKg' ? ` ${serverErrorId}` : ''}`}
            style={inputStyle}
          />
          {errors.weight && <p id="parcel-weight-error" role="alert">{text[errors.weight]}</p>}
        </div>
        <div>
          <label htmlFor="parcel-quantity" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {text.quantity}
          </label>
          <input
            id="parcel-quantity"
            type="text"
            inputMode="numeric"
            name="parcelQuantity"
            aria-label={text.quantity}
            placeholder={text.quantityExample}
            min="1"
            max={MAX_PARCEL_QUANTITY}
            step="1"
            value={quantity}
            onChange={(e) => onQuantityChange(e.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(errors.quantity) || serverField === 'parcelQuantity'}
            aria-describedby={`parcel-early-hint${errors.quantity ? ' parcel-quantity-error' : ''}${serverField === 'parcelQuantity' ? ` ${serverErrorId}` : ''}`}
            style={inputStyle}
          />
          {errors.quantity && <p id="parcel-quantity-error" role="alert">{text[errors.quantity]}</p>}
        </div>
      </div>
    </fieldset>
  );
}
