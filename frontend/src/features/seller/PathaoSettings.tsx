import { useEffect, useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import { useCourierText } from '../locale/courierCopy';
import './PathaoSettings.css';
import type { PathaoConnectInput, PathaoConnection, PathaoDefaultsInput, PathaoDeliveryType, PathaoEnvironment, PathaoStores } from './pathaoTypes';

export function PathaoSettings({ token }: { token: string }): React.JSX.Element {
  const t = useCourierText();
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production');
  return <section aria-label={t('Pathao courier settings')} className="pathao-settings-panel">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
      <h4 style={{ margin: 0, color: 'var(--primary-accent)', fontSize: '0.95rem' }}>{t('Pathao courier account')}</h4>
    </div>
    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>{t('Optional: keep creating buyer links and collecting orders without a courier connection.')}</p>
    <label className="pathao-environment-field"><span>{t('Courier environment')}</span>
      <select className="form-control" value={environment} onChange={event => setEnvironment(event.target.value === 'sandbox' ? 'sandbox' : 'production')}>
        <option value="sandbox">{t('Pathao sandbox')}</option>
        <option value="production">{t('Pathao production')}</option>
      </select>
    </label>
    <ConnectionForm key={`${token}:${environment}`} token={token} environment={environment} />
  </section>;
}

type SettingsError = 'Session lost. Sign in again to manage Pathao.'
  | 'Pathao settings changed. Reload settings before saving again.'
  | 'Pathao settings could not be loaded or saved. Check credentials and connection, then reload settings.';

function ConnectionForm({ token, environment }: { token: string; environment: PathaoEnvironment }): React.JSX.Element {
  const t = useCourierText();
  const [connection, setConnection] = useState<PathaoConnection>();
  const [stores, setStores] = useState<PathaoStores>();
  const [pickup, setPickup] = useState('');
  const [service, setService] = useState<PathaoDeliveryType>(48);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SettingsError>();
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

  if (denied) return <p role="alert">{error && t(error)}</p>;
  return <div aria-busy={busy}>
    {connection && <p>{t(connection.production_booking_enabled
      ? 'Production booking is enabled. Submit a reviewed order to create a real courier booking.'
      : 'Production booking is disabled. These settings do not create a booking.')}</p>}
    <div className={`pathao-connection-card pathao-connection-card--${error ? 'unavailable' : busy ? 'loading' : connection?.status ?? 'loading'}`}>
      <div className="pathao-connection-copy" role="status">
        <span className="pathao-connection-label">{t('Merchant connection')}</span>
        <strong className="pathao-connection-state"><span aria-hidden="true" className="pathao-connection-dot" />{error ? t('Settings unavailable') : busy ? t('Checking connection…') : connection?.status === 'connected' ? t('Connected') : connection ? t('Disconnected') : t('Loading settings…')}</strong>
        <p>{error ? t('Reload settings to confirm the current connection.') : busy || !connection ? t('Retrieving your courier account settings.') : connection.status === 'connected' ? t('Your merchant account is linked. Review your courier defaults below.') : t('Connect your merchant account to set up Pathao delivery.')}</p>
        {connection && <span className="pathao-connection-meta">{connection.merchant_hint ?? t('No merchant')} · {t('Revision')} {connection.version}</span>}
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void reload()} disabled={busy}>{t('Reload settings')}</button>
    </div>
    {environment === 'offline' && <p>{t('Simulated setup and pickup stores. No credentials or Pathao requests.')}</p>}
    {error && <p role="alert">{t(error)}</p>}
    <details className="pathao-settings-disclosure">
      <summary>{connection?.status === 'connected' ? t('Replace merchant connection') : t('Connect merchant')}</summary>
      <form ref={credentials} onSubmit={connect} autoComplete="off">
        <fieldset disabled={busy || !connection} aria-label={connection?.status === 'connected' ? t('Replace merchant connection') : t('Connect merchant')}>
          {environment !== 'offline' && <>
            <p>{t('Credentials are write-only. Replacing the connection clears pickup and service defaults.')}</p>
            <label>{t('Client ID')}<input name="client_id" className="form-control" type="password" required maxLength={256} autoComplete="off" /></label>
            <label>{t('Client secret')}<input name="client_secret" className="form-control" type="password" required maxLength={2048} autoComplete="new-password" /></label>
            <label>{t('Merchant email')}<input name="username" className="form-control" type="email" required maxLength={256} autoComplete="off" /></label>
            <label>{t('Merchant password')}<input name="password" className="form-control" type="password" required maxLength={2048} autoComplete="new-password" /></label>
          </>}
          <button className="btn btn-primary btn-sm" type="submit" style={{ marginTop: '8px' }}>{environment === 'offline' ? t('Connect simulated account') : t('Verify and save connection')}</button>
        </fieldset>
      </form>
    </details>
    {connection?.status === 'connected' && <details className="pathao-settings-disclosure">
      <summary>{t('Courier defaults')}</summary>
      <form data-defaults onSubmit={saveDefaults}>
        <fieldset disabled={busy || !stores} aria-label={t('Courier defaults')}>
          {stores?.stores.length === 0 && <p>{t('No active pickup stores. Add one in Pathao, then reload settings.')}</p>}
          <label>{t('Pickup store')}<select name="pickup" className="form-control" value={pickup} required onChange={event => setPickup(event.target.value)}>
            <option value="">{t('Choose a pickup store')}</option>
            {stores?.stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select></label>
          <label>{t('Delivery service')}<select className="form-control" value={service} onChange={event => setService(event.target.value === '12' ? 12 : 48)}>
            <option value="48">{t('Normal delivery (48)')}</option><option value="12">{t('On-demand delivery (12)')}</option>
          </select></label>
          <button className="btn btn-primary btn-sm" type="submit" disabled={!pickup || !stores?.stores.length} style={{ marginTop: '8px' }}>{t('Save courier defaults')}</button>
        </fieldset>
      </form>
    </details>}
  </div>;
}
