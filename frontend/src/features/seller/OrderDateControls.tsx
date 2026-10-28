import { useId } from 'react';
import { useLocale } from '../locale/context';
import { orderCopy, type OrderCopy } from '../locale/orderCopy';
import type { OrderDateError, OrderDateMode, OrderDateRange } from './orderDateFilter';

const PRESETS = [7, 30, 90] as const;

function orderDateErrorText(error: OrderDateError | null, text: OrderCopy): string | null {
  switch (error) {
    case 'range_required': return text.dateRangeRequired;
    case 'range_invalid': return text.dateRangeInvalid;
    case 'range_reversed': return text.dateRangeReversed;
    case 'days_invalid': return text.dateDaysInvalid;
    default: return null;
  }
}

export interface OrderDateControlsProps {
  idPrefix?: string;
  label?: string;
  mode: OrderDateMode;
  from: string;
  to: string;
  lastDays: string;
  appliedRange: OrderDateRange | null;
  error: OrderDateError | null;
  onModeChange: (mode: OrderDateMode) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onLastDaysChange: (value: string) => void;
  onApplyDates: () => void;
  onApplyPreset: (days: number) => void;
  onApplyLastDays: () => void;
}

export function OrderDateControls({
  idPrefix = 'order', label,
  mode, from, to, lastDays, appliedRange, error,
  onModeChange, onFromChange, onToChange, onLastDaysChange,
  onApplyDates, onApplyPreset, onApplyLastDays,
}: OrderDateControlsProps): React.JSX.Element {
  const { locale } = useLocale();
  const text = orderCopy[locale];
  const errorId = useId();
  const message = orderDateErrorText(error, text);
  const rangeInvalid = error === 'range_required' || error === 'range_invalid' || error === 'range_reversed';
  const daysInvalid = error === 'days_invalid';
  const describedBy = message ? errorId : undefined;
  const activeRange = appliedRange
    ? text.dateActiveRange.replace('{from}', appliedRange.from).replace('{to}', appliedRange.to)
    : null;

  return (
    <div
      lang={locale === 'bn' ? 'bn-BD' : 'en'}
      style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '10px 0' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <label htmlFor={`${idPrefix}-date-mode`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {label ?? text.dateFilter}
        </label>
        <select
          id={`${idPrefix}-date-mode`}
          value={mode}
          onChange={(event) => onModeChange(event.target.value as OrderDateMode)}
          className="form-control"
          style={{ padding: '4px 8px', fontSize: '0.8rem', minHeight: '36px', width: 'auto' }}
        >
          <option value="any">{text.dateAnyTime}</option>
          <option value="custom">{text.dateCustom}</option>
          <option value="relative">{text.dateRelative}</option>
        </select>

        {mode === 'custom' && (
          <form
            aria-label={text.dateCustom}
            noValidate
            onSubmit={(event) => { event.preventDefault(); onApplyDates(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
          >
            <label htmlFor={`${idPrefix}-date-from`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {text.dateFrom}
            </label>
            <input
              id={`${idPrefix}-date-from`}
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
              aria-invalid={rangeInvalid || undefined}
              aria-describedby={rangeInvalid ? describedBy : undefined}
              className="form-control"
              style={{ padding: '4px 8px', fontSize: '0.8rem', minHeight: '36px', width: 'auto' }}
            />
            <label htmlFor={`${idPrefix}-date-to`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {text.dateTo}
            </label>
            <input
              id={`${idPrefix}-date-to`}
              type="date"
              value={to}
              onChange={(event) => onToChange(event.target.value)}
              aria-invalid={rangeInvalid || undefined}
              aria-describedby={rangeInvalid ? describedBy : undefined}
              className="form-control"
              style={{ padding: '4px 8px', fontSize: '0.8rem', minHeight: '36px', width: 'auto' }}
            />
            <button type="submit" className="btn btn-secondary btn-sm" style={{ minHeight: '36px' }}>
              {text.dateApply}
            </button>
          </form>
        )}

        {mode === 'relative' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onApplyPreset(days)}
                style={{ minHeight: '36px' }}
              >
                {text.dateLastDaysPreset.replace('{days}', String(days))}
              </button>
            ))}
            <form
              aria-label={text.dateRelative}
              noValidate
              onSubmit={(event) => { event.preventDefault(); onApplyLastDays(); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
            >
              <label htmlFor={`${idPrefix}-date-days`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {text.dateLastDaysLabel}
              </label>
              <input
                id={`${idPrefix}-date-days`}
                type="number"
                min={1}
                max={3650}
                step={1}
                value={lastDays}
                onChange={(event) => onLastDaysChange(event.target.value)}
                aria-invalid={daysInvalid || undefined}
                aria-describedby={daysInvalid ? describedBy : undefined}
                className="form-control"
                style={{ padding: '4px 8px', fontSize: '0.8rem', minHeight: '36px', width: '100px' }}
              />
              <button type="submit" className="btn btn-secondary btn-sm" style={{ minHeight: '36px' }}>
                {text.dateApplyLastDays}
              </button>
            </form>
          </div>
        )}
      </div>

      {activeRange && (
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{activeRange}</p>
      )}
      {message && (
        <p
          id={errorId}
          role="alert"
          style={{ margin: 0, fontSize: '0.8rem', color: 'var(--rose-accent)' }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
