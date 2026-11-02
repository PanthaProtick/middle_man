import React from 'react';

export type StatusTone = 'emerald' | 'cyan' | 'amber' | 'rose' | 'neutral';

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  label: string;
  dot?: boolean;
}

export function StatusChip({
  tone = 'neutral',
  label,
  dot = true,
  className = '',
  role = 'status',
  ...rest
}: StatusChipProps): React.JSX.Element {
  const toneClass = `mm-status-chip--${tone}`;
  const classes = ['mm-status-chip', toneClass, className].filter(Boolean).join(' ');

  return (
    <span role={role} className={classes} {...rest}>
      {dot && <span className="mm-status-chip__dot" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}
