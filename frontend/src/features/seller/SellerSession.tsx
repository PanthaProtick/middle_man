import { useEffect, useLayoutEffect, useState } from 'react';
import { useAuth, useClerk } from '@clerk/react';
import { SellerSignIn } from './SellerSignIn';
import { AppShell } from '../../App';
import { LocaleProvider, LocaleSwitch, useLocale } from '../locale';
import './SellerSession.css';
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
  const { signOut } = useClerk();
  const [signInOpen, setSignInOpen] = useState(false);
  const [credential, setCredential] = useState<{ sessionId: string; token: string; bearerToken: string }>();
  const [error, setError] = useState<'token' | 'signOut'>();
  const [signingOut, setSigningOut] = useState(false);
  const [signedOutSession, setSignedOutSession] = useState<string | null>();
  const [failure, setFailure] = useState<{ sessionId: string; kind: SessionFailure; reason?: AuthReason }>();
  const [recoveryAttempts, setRecoveryAttempts] = useState({ sessionId, count: 0 });
  const [retry, setRetry] = useState(0);
  const blocked = failure !== undefined && failure.sessionId === sessionId;

  const recovering = blocked && failure.reason === 'not_yet_valid' && (recoveryAttempts.sessionId !== sessionId || recoveryAttempts.count <= 3);
  useEffect(() => {
    if (!recovering) return;
    const timer = window.setTimeout(() => setFailure(undefined), 5000);
    return () => window.clearTimeout(timer);
  }, [recovering, failure]);

  // Keep the seller tab title localized even while Clerk or the session is loading.
  useEffect(() => {
    document.title = t('document.title.seller');
  }, [t]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId || signingOut || sessionId === signedOutSession || blocked) return;
    let active = true;
    let recoveryTimer: number | undefined;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const token = await getToken();
        if (!active) return;
        if (!token) throw new Error('Session unavailable');
        setCredential(previous => ({ sessionId, bearerToken: token,
          token: previous?.sessionId === sessionId ? previous.token : token }));
        setError(undefined);
        window.clearTimeout(recoveryTimer);
        recoveryTimer = undefined;
      } catch {
        if (!active) return;
        setCredential(undefined);
        setError('token');
        if (recoveryTimer === undefined) recoveryTimer = window.setTimeout(() => {
          recoveryTimer = undefined;
          void refresh();
        }, 5000);
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30000);
    return () => { active = false; window.clearInterval(interval); window.clearTimeout(recoveryTimer); };
  }, [isLoaded, isSignedIn, sessionId, getToken, signingOut, signedOutSession, blocked, retry]);

  const token = isLoaded && isSignedIn && !signingOut && !blocked && sessionId !== signedOutSession && credential?.sessionId === sessionId
    ? credential.token : undefined;
  useLayoutEffect(() => {
    if (!token || !sessionId) return;
    return bindSellerSession(token, (kind, reason) => {
      if (reason === 'not_yet_valid') setRecoveryAttempts(previous => ({
        sessionId, count: previous.sessionId === sessionId ? previous.count + 1 : 1,
      }));
      else setCredential(undefined);
      setFailure({ sessionId, kind, reason });
    }, () => getToken({ skipCache: true }));
  }, [token, sessionId, getToken]);
  useLayoutEffect(() => {
    if (token && credential) renewSellerSessionToken(token, credential.bearerToken);
  }, [token, credential]);
  const handleSignOut = async () => {
    setSignInOpen(false);
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
    setRecoveryAttempts({ sessionId, count: 0 });
    setFailure(undefined);
    setError(undefined);
    setRetry(value => value + 1);
  };

  if (!isLoaded) return <><LocaleSwitch /><p role="status">{text.sessionLoading}</p></>;
  if (signInOpen && !isSignedIn) return <SellerSignIn />;

  const notice = blocked || error ? <section className="card seller-session-notice"
    role={recovering ? 'status' : 'alert'} aria-live={recovering ? 'polite' : 'assertive'}>
    <h3>{recovering ? text.sessionReconnecting : text.sessionAttention}</h3>
    <p>{error ? error === 'token' ? text.sessionToken : text.sessionSignOut
      : failure?.reason === 'not_yet_valid' ? recovering ? text.sessionClockWaiting : text.sessionClockHelp
      : failure?.kind === 'unauthorized'
        ? failure?.reason && failure.reason !== 'expired' ? text.sessionRejected : text.sessionExpired
        : text.sessionUnavailable}</p>
    {!recovering && <button className="btn btn-primary" onClick={retrySession}>{text.sessionRetry}</button>}
    {!recovering && failure?.reason && <details><summary>{text.diagnostic}</summary>
      <p>{text.diagnostic}: {sessionReason(failure.reason, locale)}</p>
    </details>}
  </section> : undefined;
  return <>
    <AppShell token={token} sessionId={token ? sessionId ?? undefined : undefined} sessionNotice={notice}
      onSignIn={() => {
        if (isSignedIn && sessionId !== signedOutSession) retrySession();
        else setSignInOpen(true);
      }}
      onSignOut={() => { void handleSignOut(); }} />
  </>;
}
