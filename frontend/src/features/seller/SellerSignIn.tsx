import { SignIn } from '@clerk/react';
import { LocaleSwitch, useLocale } from '../locale';
import './sellerSignIn.css';

/** Keep locale controls outside Clerk's form, but reachable throughout its flow.
 * Do not key the widget by locale: Clerk owns unfinished verification state.
 */
export function SellerSignIn(): React.JSX.Element {
  const { t } = useLocale();
  return <main className="seller-sign-in">
    <LocaleSwitch />
    <a href="/">{t('portal.backHome')}</a>
    <SignIn routing="hash" fallbackRedirectUrl="/" />
  </main>;
}
