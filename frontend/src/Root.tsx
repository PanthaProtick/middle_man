import { ClerkProvider } from '@clerk/react';
import App from './App';
import { useLocale } from './features/locale';
import { clerkBengaliLocalization } from './features/locale/clerkLocalization';
import { SellerSession } from './features/seller/SellerSession';

export interface RootProps {
  publishableKey?: string;
  publicPortal?: boolean;
}

/**
 * Chooses the authenticated seller tree or the Clerk-free public path. The
 * caller mounts one LocaleProvider above this component, so a language switch
 * updates Clerk's localization without replacing the Clerk session.
 */
export function Root({ publishableKey, publicPortal = false }: RootProps): React.JSX.Element {
  const { locale } = useLocale();

  if (!publishableKey || publishableKey.includes('your_clerk') || publicPortal) {
    return <App />;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      localization={locale === 'bn' ? clerkBengaliLocalization : undefined}
    >
      <SellerSession />
    </ClerkProvider>
  );
}
