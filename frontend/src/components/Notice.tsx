import React from 'react';

export type NoticeVariant = 'info' | 'success' | 'warning' | 'error';

export interface NoticeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: NoticeVariant;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function Notice({
  variant = 'info',
  title,
  icon,
  className = '',
  children,
  role,
  ...rest
}: NoticeProps): React.JSX.Element {
  const defaultRole = variant === 'error' || variant === 'warning' ? 'alert' : 'status';
  const ariaLive = variant === 'error' ? 'assertive' : 'polite';
  const variantClass = `mm-notice--${variant}`;
  const classes = ['mm-notice', variantClass, className].filter(Boolean).join(' ');

  return (
    <div
      role={role ?? defaultRole}
      aria-live={ariaLive}
      className={classes}
      {...rest}
    >
      {icon && <div className="mm-notice__icon">{icon}</div>}
      <div className="mm-notice__content">
        {title && <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}
