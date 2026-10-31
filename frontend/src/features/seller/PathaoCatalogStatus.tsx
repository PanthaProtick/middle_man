import { useEffect, useState } from 'react';
import { useLocale } from '../locale';
import { useCourierText } from '../locale/courierCopy';
import { formatBangladeshDateTime } from '../locale/format';
import { requestJson } from './api';
import type { PathaoEnvironment } from './pathaoTypes';

interface CatalogStatus {
  catalog_version: string | null;
  refreshed_at: string | null;
  attempted_at: string | null;
  refreshing: boolean;
  failed: boolean;
}

export function PathaoCatalogStatus({token, environment}: {token: string; environment: PathaoEnvironment}) {
  const t = useCourierText();
  const {locale} = useLocale();
  const [status, setStatus] = useState<CatalogStatus>();
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [request, setRequest] = useState(0);
  const path = `/api/seller/courier/pathao/${environment}/catalog`;
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const next = await requestJson<CatalogStatus>(path, {}, token);
        if (!active) return;
        setStatus(next);
        setFailed(false);
        setStarting(false);
        if (next.refreshing) timer = setTimeout(() => void load(), 5000);
      } catch { if (active) {setFailed(true); setStarting(false);} }
    };
    timer = setTimeout(() => void load(), request ? 1500 : 0);
    return () => {active = false; clearTimeout(timer);};
  }, [path, token, request]);
  async function refresh() {
    setStarting(true);
    setStatus(current => current ? {...current, refreshing: true} : undefined);
    try {
      await requestJson<CatalogStatus>(`${path}/refresh`, {method: 'POST'}, token);
      setRequest(value => value + 1);
    } catch { setFailed(true); setStarting(false); setStatus(current => current ? {...current, refreshing: false} : undefined); }
  }
  return <section aria-label={t('Buyer delivery locations')}>
    <p>{t('Buyer delivery locations')}</p>
    <p role="status">{status?.refreshed_at
      ? `${t('Locations last updated')}: ${formatBangladeshDateTime(status.refreshed_at, locale)}`
      : t('Locations are not ready. Buyers can submit a written address.')}</p>
    {status?.refreshing && <p role="status">{t('Updating delivery locations…')}</p>}
    {(failed || status?.failed) && <p role="alert">{status?.catalog_version
      ? t('Location refresh failed. Previously saved locations remain available.')
      : t('Location refresh failed. No saved locations are available yet.')}</p>}
    <button type="button" className="btn btn-secondary btn-sm" disabled={starting || status?.refreshing}
      onClick={() => void refresh()}>{t('Refresh locations')}</button>
    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRequest(value => value + 1)}>{t('Check location status')}</button>
  </section>;
}
