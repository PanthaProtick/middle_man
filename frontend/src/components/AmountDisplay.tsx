import React from 'react';

export type AmountType = 'advance' | 'cod' | 'due' | 'neutral';

export interface AmountDisplayProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number | string;
  currency?: string;
  type?: AmountType;
  showSign?: boolean;
}

export function AmountDisplay({
  amount,
  currency = '৳',
  type = 'neutral',
  showSign = false,
  className = '',
  ...rest
}: AmountDisplayProps): React.JSX.Element {
  const typeClass = type !== 'neutral' ? `mm-amount-display--${type}` : '';
  const classes = ['mm-amount-display', typeClass, className].filter(Boolean).join(' ');

  const formattedAmount = typeof amount === 'number'
    ? amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : amount;

  const sign = showSign && typeof amount === 'number' && amount > 0 ? '+' : '';

  return (
    <span className={classes} data-tabular-nums="true" {...rest}>
      <span className="mm-amount-display__currency">{currency}</span>
      <span className="mm-amount-display__value">{sign}{formattedAmount}</span>
    </span>
  );
}
