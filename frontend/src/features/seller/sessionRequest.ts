export type SessionFailure = 'unauthorized' | 'unavailable';

interface RequestSession {
  token: string;
  controller: AbortController;
  onFailure: (failure: SessionFailure) => void;
}

let current: RequestSession | undefined;

function failSession(session: RequestSession, failure: SessionFailure): never {
  session.controller.abort();
  session.onFailure(failure);
  throw new Error(failure === 'unauthorized' ? 'Please sign in again.' : 'Session verification is unavailable.');
}

/** One seller workspace is mounted at a time; each credential owns its requests. */
export function bindSellerSession(token: string, onFailure: RequestSession['onFailure']): () => void {
  current?.controller.abort();
  const session = { token, onFailure, controller: new AbortController() };
  current = session;
  return () => {
    session.controller.abort();
    if (current === session) current = undefined;
  };
}

/** Buffer before returning so identity changes during body delivery also fail closed. */
export async function sellerFetch(url: string, options: RequestInit = {}, token?: string): Promise<Response> {
  const session = current;
  if (session && session.token !== token) throw new Error('Seller session changed');
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, {
    ...options,
    headers: Object.fromEntries(headers.entries()),
    ...(session ? { signal: session.controller.signal } : {}),
  });
  if (session?.controller.signal.aborted) throw new Error('Seller session changed');
  if (session && response.status === 401) failSession(session, 'unauthorized');
  const body = await response.arrayBuffer();
  if (session?.controller.signal.aborted) throw new Error('Seller session changed');
  const buffered = new Response(response.status === 204 ? null : body, {
    status: response.status, statusText: response.statusText, headers: response.headers,
  });
  let failure: SessionFailure | undefined;
  if (response.status === 401) failure = 'unauthorized';
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
