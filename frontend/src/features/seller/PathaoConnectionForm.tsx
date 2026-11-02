import { useEffect, useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import { useCourierText } from '../locale/courierCopy';
import { Button, Notice } from '../../components';
import { PathaoCredentialsForm } from './PathaoCredentialsForm';
import { PathaoDefaultsForm } from './PathaoDefaultsForm';

import type {
  PathaoConnectInput,
  PathaoConnection,
  PathaoDefaultsInput,
  PathaoDeliveryType,
  PathaoEnvironment,
  PathaoStores,
} from './pathaoTypes';

type SettingsError =
  | 'Session lost. Sign in again to manage Pathao.'
  | 'Pathao settings changed. Reload settings before saving again.'
  | 'Pathao settings could not be loaded or saved. Check credentials and connection, then reload settings.';

export function PathaoConnectionForm({
  token,
  environment,
}: {
  token: string;
  environment: PathaoEnvironment;
}): React.JSX.Element {
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
      setConnection(undefined);
      setStores(undefined);
      setDenied(true);
      setError('Session lost. Sign in again to manage Pathao.');
    } else {
      setError(
        cause instanceof SellerApiError && cause.code === 'STALE_VERSION'
          ? 'Pathao settings changed. Reload settings before saving again.'
          : 'Pathao settings could not be loaded or saved. Check credentials and connection, then reload settings.',
      );
    }
  }

  async function loadStores(current: PathaoConnection) {
    setStores(undefined);
    if (current.status !== 'connected') return;
    const result = await requestJson<PathaoStores>(`${path}/stores?expected_version=${current.version}`, {}, token);
    if (alive.current) setStores(result);
  }

  async function reload() {
    setBusy(true);
    setError(undefined);
    try {
      const current = await requestJson<PathaoConnection>(path, {}, token);
      if (!alive.current) return;
      setConnection(current);
      setPickup(current.default_store_id?.toString() ?? '');
      setService(current.default_delivery_type ?? 48);
      await loadStores(current);
    } catch (cause) {
      fail(cause);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  useEffect(() => {
    alive.current = true;
    const credentialForm = credentials.current;
    void reload();
    return () => {
      alive.current = false;
      credentialForm?.reset();
    };
    // Component identity binds every request and credential field to this session/environment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection || busy) return;
    const values = new FormData(event.currentTarget);
    const payload: PathaoConnectInput = {
      expected_version: connection.version,
      ...(environment === 'offline'
        ? {}
        : {
            credentials: {
              client_id: String(values.get('client_id') ?? ''),
              client_secret: String(values.get('client_secret') ?? ''),
              username: String(values.get('username') ?? ''),
              password: String(values.get('password') ?? ''),
            },
          }),
    };
    event.currentTarget.reset();
    setBusy(true);
    setError(undefined);
    setStores(undefined);
    try {
      const result = await requestJson<PathaoConnection>(path, { method: 'PUT', body: JSON.stringify(payload) }, token);
      if (!alive.current) return;
      setConnection(result);
      setPickup('');
      setService(48);
      await loadStores(result);
    } catch (cause) {
      fail(cause);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function saveDefaults(event: React.FormEvent) {
    event.preventDefault();
    if (!connection || busy || !pickup) return;
    setBusy(true);
    setError(undefined);
    const payload: PathaoDefaultsInput = {
      expected_version: connection.version,
      default_store_id: Number(pickup),
      default_delivery_type: service,
    };
    try {
      const result = await requestJson<PathaoConnection>(path, { method: 'PATCH', body: JSON.stringify(payload) }, token);
      if (!alive.current) return;
      setConnection(result);
      await loadStores(result);
    } catch (cause) {
      fail(cause);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  if (denied) return <p role="alert">{error && t(error)}</p>;

  return (
    <div aria-busy={busy}>
      {connection && (
        <p>
          {t(
            connection.production_booking_enabled
              ? 'Production booking is enabled. Submit a reviewed order to create a real courier booking.'
              : 'Production booking is disabled. These settings do not create a booking.',
          )}
        </p>
      )}
      <div
        className={`pathao-connection-card pathao-connection-card--${
          error ? 'unavailable' : busy ? 'loading' : connection?.status ?? 'loading'
        }`}
      >
        <div className="pathao-connection-copy" role="status">
          <span className="pathao-connection-label">{t('Merchant connection')}</span>
          <strong className="pathao-connection-state">
            <span aria-hidden="true" className="pathao-connection-dot" />
            {error
              ? t('Settings unavailable')
              : busy
                ? t('Checking connection…')
                : connection?.status === 'connected'
                  ? t('Connected')
                  : connection
                    ? t('Disconnected')
                    : t('Loading settings…')}
          </strong>
          <p>
            {error
              ? t('Reload settings to confirm the current connection.')
              : busy || !connection
                ? t('Retrieving your courier account settings.')
                : connection.status === 'connected'
                  ? t('Your merchant account is linked. Review your courier defaults below.')
                  : t('Connect your merchant account to set up Pathao delivery.')}
          </p>
          {connection && (
            <span className="pathao-connection-meta">
              {connection.merchant_hint ?? t('No merchant')} · {t('Revision')} {connection.version}
            </span>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => void reload()} disabled={busy}>
          {t('Reload settings')}
        </Button>
      </div>

      {environment === 'offline' && (
        <p>{t('Simulated setup and pickup stores. No credentials or Pathao requests.')}</p>
      )}
      {error && <Notice variant="error" role="alert" className="pathao-error-notice">{t(error)}</Notice>}

      <PathaoCredentialsForm
        credentialsRef={credentials}
        onSubmit={connect}
        connected={connection?.status === 'connected'}
        disabled={busy || !connection}
        environment={environment}
      />

      {connection?.status === 'connected' && (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          className="pathao-disconnect-btn"
          onClick={() => {
            setBusy(true);
            void requestJson<PathaoConnection>(`${path}?expected_version=${connection.version}`, { method: 'DELETE' }, token)
              .then(result => {
                if (alive.current) {
                  setConnection(result);
                  setStores(undefined);
                }
              })
              .catch(fail)
              .finally(() => {
                if (alive.current) setBusy(false);
              });
          }}
        >
          {t('Disconnect Pathao')}
        </Button>
      )}

      {connection?.status === 'connected' && (
        <PathaoDefaultsForm
          busy={busy}
          stores={stores}
          pickup={pickup}
          setPickup={setPickup}
          service={service}
          setService={setService}
          onSubmit={saveDefaults}
        />
      )}
    </div>
  );
}
