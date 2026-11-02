import React from 'react';
import { ArrowRight, Sparkles, LayoutDashboard, ShieldAlert } from 'lucide-react';
import { landingCopy } from './landingCopy';
import type { Locale } from '../locale';

interface LandingHeroProps {
  locale: Locale;
  onSignIn?: () => void;
  onToggleDemo?: () => void;
  isDemoOpen?: boolean;
}

export function LandingHero({
  locale,
  onSignIn,
  onToggleDemo,
  isDemoOpen = false,
}: LandingHeroProps): React.JSX.Element {
  const copy = landingCopy[locale].hero;

  const scrollToTour = () => {
    const el = document.getElementById('tour-heading');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      el.focus?.();
    }
  };

  return (
    <header className="landing-hero" aria-labelledby="hero-title">
      <div className="hero-content">
        <h1 id="hero-title">
          {copy.title} <span className="hero-title-accent">{copy.titleAccent}</span>
        </h1>
        <p className="hero-lead">{copy.lead}</p>

        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={onSignIn}
          >
            <span>{copy.primaryCta}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={scrollToTour}
          >
            <Sparkles size={16} aria-hidden="true" />
            <span>{copy.secondaryCta}</span>
          </button>

          {onToggleDemo && (
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={onToggleDemo}
              aria-expanded={isDemoOpen}
            >
              <LayoutDashboard size={16} aria-hidden="true" />
              <span>{isDemoOpen ? copy.demoToggleClose : copy.demoToggleOpen}</span>
            </button>
          )}
        </div>

        <div className="hero-trust-bar" role="note">
          <ShieldAlert size={16} color="var(--primary-accent)" aria-hidden="true" />
          <span>{copy.badge}</span>
        </div>
      </div>
    </header>
  );
}
