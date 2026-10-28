import React, { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { catalogs, interpolate } from './catalog';
import { LocaleContext, type LocaleContextValue, type Translate } from './context';
import { persistLocale, resolveInitialLocale, type Locale } from './storage';

interface LocaleProviderProps {
  children: ReactNode;
}

/**
 * Only the outermost provider owns locale state. App and SellerSession mount
 * nested providers so they still work standalone, but under the application
 * root those become pass-through wrappers around the same device selection.
 */
export function LocaleProvider({ children }: LocaleProviderProps): React.JSX.Element {
  const parent = useContext(LocaleContext);
  if (parent.provided) return <>{children}</>;
  return <LocaleProviderState>{children}</LocaleProviderState>;
}

function LocaleProviderState({ children }: LocaleProviderProps): React.JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const t = useCallback<Translate>(
    (key, params) => interpolate(catalogs[locale][key], params),
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t, provided: true }),
    [locale, setLocale, t],
  );

  useEffect(() => {
    document.documentElement.lang = locale === 'bn' ? 'bn-BD' : 'en';
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
