import { useEffect, useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import type { PathaoConnectInput, PathaoConnection, PathaoDefaultsInput, PathaoDeliveryType, PathaoEnvironment, PathaoStores } from './pathaoTypes';

export function PathaoSettings({ token }: { token: string }): React.JSX.Element {
  const [environment, setEnvironment] = useState<PathaoEnvironment>('offline');
  return <section aria-label="Pathao courier settings">
    <h4>Pathao courier account</h4>
    <p>Optional: keep creating buyer links and collecting orders without a courier connection.</p>
    <p>Production booking is disabled. These settings do not create a booking.</p>
    <label>Courier environment
      <select value={environment} onChange={event => setEnvironment(event.target.value as PathaoEnvironment)}>
        <option value="offline">Offline — simulated</option>
        <option value="sandbox">Pathao sandbox</option>
        <option value="production">Pathao production — setup only</option>
      </select>
    </label>
    <ConnectionForm key={`${token}:${environment}`} token={token} environment={environment} />
  </section>;
}

function ConnectionForm({ token, environment }: { token: string; environment: PathaoEnvironment }): React.JSX.Element {
  const [connection, setConnection] = useState<PathaoConnection>();
  const [stores, setStores] = useState<PathaoStores>();
  const [pickup, setPickup] = useState('');
  const [service, setService] = useState<PathaoDeliveryType>(48);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [denied, setDenied] = useState(false);
  const alive = useRef(true);
  const credentials = useRef<HTMLFormElement>(null);
  const path = `/api/seller/courier/pathao/${environment}`;

  function fail(cause: unknown) {
    if (!alive.current) return;
    credentials.current?.reset();
    if (cause instanceof SellerApiError && (cause.status === 401 || cause.status === 403)) {
      setConnection(undefined); setStores(undefined); setDenied(true);
      setError('Session lost. Sign in again to manage Pathao.');
    } else {
      setError(cause instanceof SellerApiError && cause.code === 'STALE_VERSION'
        ? 'Pathao settings changed. Reload settings before saving again.'
        : 'Pathao settings could not be loaded or saved. Check credentials and connection, then reload settings.');
    }
  }

  async function loadStores(current: PathaoConnection) {
    setStores(undefined);
    if (current.status !== 'connected') return;
    const result = await requestJson<PathaoStores>(`${path}/stores?expected_version=${current.version}`, {}, token);
    if (alive.current) setStores(result);
  }

  async function reload() {
    setBusy(true); setError(undefined);
    try {
      const current = await requestJson<PathaoConnection>(path, {}, token);
      if (!alive.current) return;
      setConnection(current); setPickup(current.default_store_id?.toString() ?? '');
      setService(current.default_delivery_type ?? 48);
      await loadStores(current);
    } catch (cause) { fail(cause); }
    finally { if (alive.current) setBusy(false); }
  }

  useEffect(() => {
    alive.current = true;
    const credentialForm = credentials.current;
    void reload();
    return () => { alive.current = false; credentialForm?.reset(); };
    // Component identity binds every request and credential field to this session/environment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection || busy) return;
    const values = new FormData(event.currentTarget);
    const payload: PathaoConnectInput = { expected_version: connection.version,
      ...(environment === 'offline' ? {} : { credentials: {
        client_id: String(values.get('client_id') ?? ''), client_secret: String(values.get('client_secret') ?? ''),
        username: String(values.get('username') ?? ''), password: String(values.get('password') ?? ''),
      } }),
    };
    event.currentTarget.reset();
    setBusy(true); setError(undefined); setStores(undefined);
    try {
      const result = await requestJson<PathaoConnection>(path, { method: 'PUT', body: JSON.stringify(payload) }, token);
      if (!alive.current) return;
      setConnection(result); setPickup(''); setService(48);
      await loadStores(result);
    } catch (cause) { fail(cause); }
    finally { if (alive.current) setBusy(false); }
  }

  async function saveDefaults(event: React.FormEvent) {
    event.preventDefault();
    if (!connection || busy || !pickup) return;
    setBusy(true); setError(undefined);
    const payload: PathaoDefaultsInput = {
      expected_version: connection.version, default_store_id: Number(pickup), default_delivery_type: service,
    };
    try {
      const result = await requestJson<PathaoConnection>(path, { method: 'PATCH', body: JSON.stringify(payload) }, token);
      if (!alive.current) return;
      setConnection(result);
      await loadStores(result);
    } catch (cause) { fail(cause); }
    finally { if (alive.current) setBusy(false); }
  }

  if (denied) return <p role="alert">{error}</p>;
  return <div aria-busy={busy}>
    <p role="status">{connection ? `${connection.status} · Revision ${connection.version} · ${connection.merchant_hint ?? 'No merchant'}` : error ? 'Settings unavailable' : 'Loading settings…'}</p>
    {environment === 'offline' && <p>Simulated setup and pickup stores. No credentials or Pathao requests.</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" className="btn" onClick={() => void reload()} disabled={busy}>Reload settings</button>
    <form ref={credentials} onSubmit={connect} autoComplete="off">
      <fieldset disabled={busy || !connection}>
        <legend>{connection?.status === 'connected' ? 'Replace merchant connection' : 'Connect merchant'}</legend>
        {environment !== 'offline' && <>
          <p>Credentials are write-only. Replacing the connection clears pickup and service defaults.</p>
          <label>Client ID<input name="client_id" type="password" required maxLength={256} autoComplete="off" /></label>
          <label>Client secret<input name="client_secret" type="password" required maxLength={2048} autoComplete="new-password" /></label>
          <label>Merchant email<input name="username" type="email" required maxLength={256} autoComplete="off" /></label>
          <label>Merchant password<input name="password" type="password" required maxLength={2048} autoComplete="new-password" /></label>
        </>}
        <button className="btn" type="submit">{environment === 'offline' ? 'Connect simulated account' : 'Verify and save connection'}</button>
      </fieldset>
    </form>
    {connection?.status === 'connected' && <form data-defaults onSubmit={saveDefaults}>
      <fieldset disabled={busy || !stores}>
        <legend>Courier defaults</legend>
        {stores?.stores.length === 0 && <p>No active pickup stores. Add one in Pathao, then reload settings.</p>}
        <label>Pickup store<select name="pickup" value={pickup} required onChange={event => setPickup(event.target.value)}>
          <option value="">Choose a pickup store</option>
          {stores?.stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select></label>
        <label>Delivery service<select value={service} onChange={event => setService(event.target.value === '12' ? 12 : 48)}>
          <option value="48">Normal delivery (48)</option><option value="12">On-demand delivery (12)</option>
        </select></label>
        <button className="btn" type="submit" disabled={!pickup || !stores?.stores.length}>Save courier defaults</button>
      </fieldset>
    </form>}
  </div>;
}
