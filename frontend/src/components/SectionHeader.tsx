import React from 'react';

export interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  headingLevel?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  className?: string;
}

export function SectionHeader({
  title,
  description,
  badge,
  actions,
  headingLevel = 'h2',
  className = '',
}: SectionHeaderProps): React.JSX.Element {
  const HeadingTag = headingLevel;

  return (
    <header className={`mm-section-header ${className}`.trim()}>
      <div>
        <div className="mm-section-header__title-group">
          <HeadingTag className="mm-section-header__title">{title}</HeadingTag>
          {badge}
        </div>
        {description && <p className="mm-section-header__desc">{description}</p>}
      </div>
      {actions && <div className="mm-section-header__actions">{actions}</div>}
    </header>
  );
}
