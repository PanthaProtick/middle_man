import { useEffect, useState } from 'react';
import { useAuth, useClerk } from '@clerk/react';
import App from '../../App';

/** The SDK owns session persistence; application bearer tokens stay in memory. */
export function SellerSession(): React.JSX.Element {
  const { isLoaded, isSignedIn, sessionId, getToken } = useAuth();
  const { openSignIn, signOut } = useClerk();
  const [credential, setCredential] = useState<{ sessionId: string; token: string }>();
  const [error, setError] = useState<string>();
  const [signingOut, setSigningOut] = useState(false);
  const [signedOutSession, setSignedOutSession] = useState<string | null>();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId || signingOut || sessionId === signedOutSession) return;
    let active = true;
    const refresh = async () => {
      try {
        const token = await getToken();
        if (!active) return;
        if (!token) throw new Error('Session unavailable');
        setCredential({ sessionId, token });
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
  }, [isLoaded, isSignedIn, sessionId, getToken, signingOut, signedOutSession]);

  const token = isLoaded && isSignedIn && !signingOut && sessionId !== signedOutSession && credential?.sessionId === sessionId
    ? credential.token : undefined;
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

  return <>
    {error && <p role="alert">{error}</p>}
    <App token={token} sessionId={token ? sessionId ?? undefined : undefined}
      onSignIn={isLoaded ? () => { void openSignIn(); } : undefined}
      onSignOut={() => { void handleSignOut(); }} />
  </>;
}
