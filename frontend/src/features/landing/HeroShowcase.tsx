import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Truck,
  ExternalLink,
  Receipt,
  Package,
} from 'lucide-react';
import type { Locale } from '../locale';
import { heroShowcaseCopy, type HeroShowcaseStep } from './heroShowcaseCopy';
import './HeroShowcase.css';

interface HeroShowcaseProps {
  locale: Locale;
}

type StepKey = 'link' | 'match' | 'courier';

export function HeroShowcase({ locale }: HeroShowcaseProps): React.JSX.Element {
  const [activeStep, setActiveStep] = useState<StepKey>('link');
  const copy = heroShowcaseCopy[locale];
  const stepData: HeroShowcaseStep = copy.steps[activeStep];

  const getStepIcon = (key: StepKey) => {
    switch (key) {
      case 'link':
        return <ExternalLink size={14} aria-hidden="true" />;
      case 'match':
        return <Receipt size={14} aria-hidden="true" />;
      case 'courier':
        return <Truck size={14} aria-hidden="true" />;
    }
  };

  const getGuaranteeIcon = (id: string) => {
    switch (id) {
      case 'advance':
        return <ShieldCheck size={14} className="guarantee-icon" aria-hidden="true" />;
      case 'match':
        return <CheckCircle2 size={14} className="guarantee-icon" aria-hidden="true" />;
      case 'dispatch':
        return <Truck size={14} className="guarantee-icon" aria-hidden="true" />;
      default:
        return <Package size={14} className="guarantee-icon" aria-hidden="true" />;
    }
  };

  return (
    <aside
      className="hero-showcase"
      role="region"
      aria-label={copy.deskLabel}
      lang={locale}
      data-testid="hero-showcase"
    >
      <div className="showcase-header">
        <div className="showcase-badge-group">
          <span className="showcase-brand-tag">{copy.deskLabel}</span>
          <span className="showcase-live-pill" role="status">
            <span className="showcase-live-dot" aria-hidden="true" />
            <span>{copy.activeStatus}</span>
          </span>
        </div>
      </div>

      <p className="showcase-intro-headline">{copy.introHeadline}</p>

      <div
        className="showcase-stepper"
        role="group"
        aria-label={copy.deskLabel}
      >
        {(['link', 'match', 'courier'] as const).map((key) => {
          const isActive = activeStep === key;
          const stepInfo = copy.steps[key];
          return (
            <button
              key={key}
              type="button"
              id={`showcase-tab-${key}`}
              aria-pressed={isActive}
              className={`showcase-tab${isActive ? ' active' : ''}`}
              onClick={() => setActiveStep(key)}
            >
              {getStepIcon(key)}
              <span>{stepInfo.tab}</span>
            </button>
          );
        })}
      </div>

      <div
        key={activeStep}
        id={`showcase-panel-${activeStep}`}
        className="showcase-microcard"
      >
        <div className="microcard-header">
          <span className="microcard-order-id">{stepData.orderNumber}</span>
          <span className="microcard-status-pill">
            <CheckCircle2 size={12} aria-hidden="true" />
            <span>{stepData.statusChip}</span>
          </span>
        </div>

        <div className="microcard-step-title">{stepData.title}</div>

        <div className="microcard-item-row">
          <div className="microcard-item-title">{stepData.item}</div>
          <div className="microcard-item-detail">{stepData.itemDetail}</div>
        </div>

        <div className="microcard-metrics-grid">
          <div className="microcard-metric">
            <span className="metric-label">{stepData.totalLabel}</span>
            <span className="metric-value">{stepData.totalValue}</span>
          </div>
          <div className="microcard-metric">
            <span className="metric-label">{stepData.advanceLabel}</span>
            <span className="metric-value highlight">{stepData.advanceValue}</span>
          </div>
        </div>

        <div className="microcard-highlight-bar">
          <span className="highlight-label">{stepData.primaryMetricLabel}:</span>
          <span className="highlight-value">{stepData.primaryMetricValue}</span>
        </div>

        <p className="microcard-note">{stepData.note}</p>
      </div>

      <div className="showcase-guarantees" aria-label={locale === 'bn' ? 'অর্ডারের কাজ এক জায়গায়' : 'Order work in one place'}>
        {copy.guarantees.map((item) => (
          <div key={item.id} className="guarantee-chip">
            {getGuaranteeIcon(item.id)}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
