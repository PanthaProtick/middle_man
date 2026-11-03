import React from 'react';

export interface LoadingStateProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingState({
  label = 'Loading…',
  size = 'md',
  className = '',
}: LoadingStateProps): React.JSX.Element {
  const spinnerSize = size === 'sm' ? 14 : size === 'lg' ? 28 : 20;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mm-loading-state ${className}`.trim()}
    >
      <span
        className="mm-loading-state__spinner"
        style={{ width: spinnerSize, height: spinnerSize }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
