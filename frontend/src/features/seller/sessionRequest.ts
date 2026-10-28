export type SessionFailure = 'unauthorized' | 'unavailable';
const authReasons = ['expired', 'not_yet_valid', 'issuer_mismatch', 'audience_mismatch',
  'origin_mismatch', 'invalid_signature', 'rejected'] as const;
export type AuthReason = typeof authReasons[number];

function authReason(value: string | null): AuthReason | undefined {
  return authReasons.find(reason => reason === value);
}

interface RequestSession {
  token: string;
  bearerToken: string;
  controller: AbortController;
  onFailure: (failure: SessionFailure, reason?: AuthReason) => void;
  refreshToken?: () => Promise<string | null>;
}

let current: RequestSession | undefined;

function failSession(session: RequestSession, failure: SessionFailure, reason?: AuthReason): never {
  session.controller.abort();
  if (reason) session.onFailure(failure, reason);
  else session.onFailure(failure);
  throw new Error(failure === 'unauthorized' ? 'Please sign in again.' : 'Session verification is unavailable.');
}

/** One seller workspace is mounted at a time; session changes abort its requests. */
export function bindSellerSession(token: string, onFailure: RequestSession['onFailure'], refreshToken?: RequestSession['refreshToken']): () => void {
  current?.controller.abort();
  const session = { token, bearerToken: token, onFailure, refreshToken, controller: new AbortController() };
  current = session;
  return () => {
    session.controller.abort();
    if (current === session) current = undefined;
  };
}

/** Rotate the bearer within the same session without resetting forms or in-flight reads. */
export function renewSellerSessionToken(token: string, bearerToken: string): void {
  if (current?.token === token) current.bearerToken = bearerToken;
}

/** Buffer before returning so identity changes during body delivery also fail closed. */
export async function sellerFetch(url: string, options: RequestInit = {}, token?: string): Promise<Response> {
  const session = current;
  if (session && session.token !== token) throw new Error('Seller session changed');
  const headers = new Headers(options.headers);
  const sentBearer = session?.bearerToken ?? token;
  if (token) headers.set('Authorization', `Bearer ${sentBearer}`);
  const request = {
    ...options,
    headers: Object.fromEntries(headers.entries()),
    ...(session ? { signal: session.controller.signal } : {}),
  };
  let response = await fetch(url, request);
  if (session?.controller.signal.aborted) throw new Error('Seller session changed');
  if (session && response.status === 401) {
    const reason = authReason(response.headers.get('X-Seller-Auth-Reason'));
    if (reason === 'expired' && session.refreshToken) {
      let replacement: string | null = null;
      try { replacement = await session.refreshToken(); } catch { /* Report the original rejection below. */ }
      if (session.controller.signal.aborted) throw new Error('Seller session changed');
      if (replacement && replacement !== sentBearer) {
        session.bearerToken = replacement;
        if (!options.method || ['GET', 'HEAD'].includes(options.method.toUpperCase())) {
          headers.set('Authorization', `Bearer ${replacement}`);
          response = await fetch(url, { ...request, headers: Object.fromEntries(headers.entries()) });
          if (session.controller.signal.aborted) throw new Error('Seller session changed');
        }
      } else failSession(session, 'unauthorized', reason);
    } else failSession(session, 'unauthorized', reason);
    if (response.status === 401 && (!options.method || ['GET', 'HEAD'].includes(options.method.toUpperCase()))) {
      failSession(session, 'unauthorized', authReason(response.headers.get('X-Seller-Auth-Reason')));
    }
  }
  const body = await response.arrayBuffer();
  if (session?.controller.signal.aborted) throw new Error('Seller session changed');
  const buffered = new Response(response.status === 204 ? null : body, {
    status: response.status, statusText: response.statusText, headers: response.headers,
  });
  let failure: SessionFailure | undefined;
  if (response.status === 503) {
    try {
      const error = await buffered.clone().json() as { error?: { code?: string } };
      if (error.error?.code === 'AUTH_UNAVAILABLE') failure = 'unavailable';
    } catch { /* Non-authentication outages retain their feature-specific handling. */ }
  }
  if (session?.controller.signal.aborted) throw new Error('Seller session changed');
  if (failure && session) {
    failSession(session, failure);
  }
  return buffered;
}
