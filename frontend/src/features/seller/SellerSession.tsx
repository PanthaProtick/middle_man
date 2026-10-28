import { useEffect, useLayoutEffect, useState } from 'react';
import { useAuth, useClerk } from '@clerk/react';
import { AppShell } from '../../App';
import { LocaleProvider, LocaleSwitch, useLocale } from '../locale';
import { sessionReason } from './sessionReason';
import { sellerCopy } from '../locale/sellerCopy';
import { bindSellerSession, renewSellerSessionToken, type AuthReason, type SessionFailure } from './sessionRequest';

/** The SDK owns session persistence; application bearer tokens stay in memory. */
export function SellerSession(): React.JSX.Element {
  return <LocaleProvider><SellerSessionContent /></LocaleProvider>;
}

function SellerSessionContent(): React.JSX.Element {
  const { locale, t } = useLocale();
  const text = sellerCopy[locale];
  const { isLoaded, isSignedIn, sessionId, getToken } = useAuth();
  const { openSignIn, signOut } = useClerk();
  const [credential, setCredential] = useState<{ sessionId: string; token: string; bearerToken: string }>();
  const [error, setError] = useState<'token' | 'signOut'>();
  const [signingOut, setSigningOut] = useState(false);
  const [signedOutSession, setSignedOutSession] = useState<string | null>();
  const [failure, setFailure] = useState<{ sessionId: string; kind: SessionFailure; reason?: AuthReason }>();
  const [retry, setRetry] = useState(0);
  const blocked = failure !== undefined && failure.sessionId === sessionId;

  // Keep the seller tab title localized even while Clerk or the session is loading.
  useEffect(() => {
    document.title = t('document.title.seller');
  }, [t]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId || signingOut || sessionId === signedOutSession || blocked) return;
    let active = true;
    const refresh = async () => {
      try {
        const token = await getToken();
        if (!active) return;
        if (!token) throw new Error('Session unavailable');
        setCredential(previous => ({ sessionId, bearerToken: token,
          token: previous?.sessionId === sessionId ? previous.token : token }));
        setError(undefined);
      } catch {
        if (!active) return;
        setCredential(undefined);
        setError('token');
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30000);
    return () => { active = false; window.clearInterval(interval); };
  }, [isLoaded, isSignedIn, sessionId, getToken, signingOut, signedOutSession, blocked, retry]);

  const token = isLoaded && isSignedIn && !signingOut && !blocked && sessionId !== signedOutSession && credential?.sessionId === sessionId
    ? credential.token : undefined;
  useLayoutEffect(() => {
    if (!token || !sessionId) return;
    return bindSellerSession(token, (kind, reason) => {
      setCredential(undefined);
      setFailure({ sessionId, kind, reason });
    });
  }, [token, sessionId]);
  useLayoutEffect(() => {
    if (token && credential) renewSellerSessionToken(token, credential.bearerToken);
  }, [token, credential]);
  const handleSignOut = async () => {
    setSigningOut(true);
    setSignedOutSession(sessionId);
    setCredential(undefined);
    try {
      await signOut();
    } catch {
      setSignedOutSession(undefined);
      setError('signOut');
    } finally {
      setSigningOut(false);
    }
  };
  const retrySession = () => {
    setFailure(undefined);
    setError(undefined);
    setRetry(value => value + 1);
  };

  if (!isLoaded) return <><LocaleSwitch /><p role="status">{text.sessionLoading}</p></>;

  return <>
    {error && <p role="alert">{error === 'token' ? text.sessionToken : text.sessionSignOut}</p>}
    {blocked && <div role="alert">
      <p>{failure?.kind === 'unauthorized'
        ? failure?.reason && failure.reason !== 'expired' ? text.sessionRejected : text.sessionExpired
        : text.sessionUnavailable}</p>
      {failure?.reason && <p>{text.diagnostic}: {sessionReason(failure.reason, locale)}</p>}
      <button onClick={retrySession}>{text.sessionRetry}</button>
    </div>}
    <AppShell token={token} sessionId={token ? sessionId ?? undefined : undefined}
      onSignIn={() => {
        if (isSignedIn && sessionId !== signedOutSession) retrySession();
        else void openSignIn();
      }}
      onSignOut={() => { void handleSignOut(); }} />
  </>;
}
