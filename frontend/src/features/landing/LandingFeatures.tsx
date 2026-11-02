import React from 'react';
import { ShieldCheck, Banknote, Truck, Globe2 } from 'lucide-react';
import { landingCopy } from './landingCopy';
import type { Locale } from '../locale';

interface LandingFeaturesProps {
  locale: Locale;
}

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  'advance-lock': <ShieldCheck size={22} color="var(--primary-accent)" aria-hidden="true" />,
  'reconciliation-engine': <Banknote size={22} color="var(--primary-accent)" aria-hidden="true" />,
  'pathao-integration': <Truck size={22} color="var(--primary-accent)" aria-hidden="true" />,
  'bilingual-operator': <Globe2 size={22} color="var(--primary-accent)" aria-hidden="true" />,
};

export function LandingFeatures({ locale }: LandingFeaturesProps): React.JSX.Element {
  const copy = landingCopy[locale].features;

  return (
    <section className="landing-features" aria-labelledby="features-heading">
      <div className="features-header">
        <h2 id="features-heading">{copy.sectionHeading}</h2>
        <p className="features-subheading">{copy.sectionDescription}</p>
      </div>

      <div className="features-grid">
        {copy.items.map((item) => (
          <article key={item.id} className="feature-item">
            <div className="feature-icon-wrapper">
              {FEATURE_ICONS[item.id] ?? <ShieldCheck size={22} aria-hidden="true" />}
            </div>
            <div className="feature-content">
              <span className="feature-pill">{item.highlight}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
