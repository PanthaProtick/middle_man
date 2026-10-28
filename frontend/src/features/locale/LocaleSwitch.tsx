import React from 'react';
import { useLocale } from './context';

/**
 * Both language names stay visible in either mode so a person who cannot read
 * the current language can still find the other one.
 */
export function LocaleSwitch(): React.JSX.Element {
  const { locale, setLocale, t } = useLocale();
  const selectedLanguage = locale === 'bn' ? t('locale.bengali') : t('locale.english');

  return (
    <div className="locale-switch" role="group" aria-label={t('locale.label')}>
      <button
        type="button"
        lang="bn"
        aria-pressed={locale === 'bn'}
        onClick={() => setLocale('bn')}
      >
        {t('locale.bengali')}
      </button>
      <button
        type="button"
        lang="en"
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        {t('locale.english')}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {t('locale.announcement', { language: selectedLanguage })}
      </span>
    </div>
  );
}
