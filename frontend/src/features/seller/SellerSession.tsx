import { useEffect, useLayoutEffect, useState } from 'react';
import { useAuth, useClerk } from '@clerk/react';
import App from '../../App';
import { bindSellerSession, renewSellerSessionToken, type AuthReason, type SessionFailure } from './sessionRequest';

/** The SDK owns session persistence; application bearer tokens stay in memory. */
export function SellerSession(): React.JSX.Element {
  const { isLoaded, isSignedIn, sessionId, getToken } = useAuth();
  const { openSignIn, signOut } = useClerk();
  const [credential, setCredential] = useState<{ sessionId: string; token: string; bearerToken: string }>();
  const [error, setError] = useState<string>();
  const [signingOut, setSigningOut] = useState(false);
  const [signedOutSession, setSignedOutSession] = useState<string | null>();
  const [failure, setFailure] = useState<{ sessionId: string; kind: SessionFailure; reason?: AuthReason }>();
  const [retry, setRetry] = useState(0);
  const blocked = failure !== undefined && failure.sessionId === sessionId;

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
        setError('Unable to obtain your seller session. Please sign in again.');
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
      setError('Unable to sign out. Please retry.');
    } finally {
      setSigningOut(false);
    }
  };
  const retrySession = () => {
    setFailure(undefined);
    setError(undefined);
    setRetry(value => value + 1);
  };

  if (!isLoaded) return <p role="status">Loading seller sign-in…</p>;

  return <>
    {error && <p role="alert">{error}</p>}
    {blocked && <div role="alert">
      <p>{failure?.kind === 'unauthorized'
        ? 'Your seller session has expired. Please sign in again.'
        : 'Session verification is unavailable. Please retry.'}</p>
      {failure?.reason && <p>Session diagnostic: {failure.reason}</p>}
      <button onClick={retrySession}>Retry seller session</button>
    </div>}
    <App token={token} sessionId={token ? sessionId ?? undefined : undefined}
      onSignIn={() => {
        if (isSignedIn && sessionId !== signedOutSession) retrySession();
        else void openSignIn();
      }}
      onSignOut={() => { void handleSignOut(); }} />
  </>;
}
