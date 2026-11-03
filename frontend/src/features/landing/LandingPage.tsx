import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../locale';
import { landingCopy } from './landingCopy';
import { LandingHero } from './LandingHero';
import { InteractiveProductTour } from './InteractiveProductTour';
import { LandingFeatures } from './LandingFeatures';
import './LandingPage.css';

interface LandingPageProps {
  onSignIn?: () => void;
  children?: React.ReactNode;
}

export function LandingPage({
  onSignIn,
  children,
}: LandingPageProps): React.JSX.Element {
  const { locale } = useLocale();
  const copy = landingCopy[locale];

  return (
    <div className="landing-page-root">
      <LandingHero
        locale={locale}
        onSignIn={onSignIn}
      />

      <InteractiveProductTour locale={locale} />

      <LandingFeatures locale={locale} />

      <section className="landing-cta-banner" aria-labelledby="cta-heading">
        <h2 id="cta-heading">{copy.ctaBanner.heading}</h2>
        <p>{copy.ctaBanner.subheading}</p>
        <button
          type="button"
          className="btn-banner"
          onClick={onSignIn}
        >
          <span>{copy.ctaBanner.button}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <p className="banner-guarantee">{copy.ctaBanner.guarantee}</p>
      </section>

      {children && (
        <section
          id="workspace"
          tabIndex={-1}
          className="landing-workspace-preview"
          aria-labelledby="desk-preview-heading"
        >
          <div className="workspace-preview-header">
            <h2 id="desk-preview-heading">
              {locale === 'bn' ? 'লাইভ শপ ডেস্ক প্রিভিউ' : 'Live Shop Desk Preview'}
            </h2>
            <p>
              {locale === 'bn'
                ? 'সাইন ইন করার আগেই অফলাইন স্ট্যান্ডবাই মোডে মধ্যস্বত্ব ডেস্কের ইন্টারফেস পরীক্ষা করুন।'
                : 'Test the Middleman shop desk in offline standby mode before signing in.'}
            </p>
          </div>
          {children}
        </section>
      )}
    </div>
  );
}
