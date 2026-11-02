import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps): React.JSX.Element {
  const titleId = React.useId();
  return (
    <div className={`mm-empty-state ${className}`.trim()} role="region" aria-labelledby={titleId}>
      {icon && <div className="mm-empty-state__icon" aria-hidden="true">{icon}</div>}
      <h3 id={titleId} className="mm-empty-state__title">{title}</h3>
      {description && <p className="mm-empty-state__copy">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
