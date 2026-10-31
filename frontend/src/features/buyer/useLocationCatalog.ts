import { useEffect, useRef, useState } from 'react';
import type { LocationAvailability, LocationCatalog, PathaoSelection } from './pathaoTypes';
import type { MessageKey } from '../locale';

interface CatalogCache {
  scope: string;
  version?: string;
  lists: Map<string, LocationCatalog>;
}

function catalogQueries(city?: number, zone?: number) {
  return ['', city ? `city_id=${city}` : null,
    city && zone ? `city_id=${city}&zone_id=${zone}` : null];
}

export function useLocationCatalog(token: string, value: PathaoSelection,
  onAvailabilityChange?: (value: LocationAvailability) => void) {
  const [retry, setRetry] = useState(0);
  const scope = JSON.stringify([token, retry]);
  const cache = useRef<CatalogCache>({scope, lists: new Map()});
  const [data, setData] = useState<CatalogCache>(() => ({scope, lists: new Map()}));
  const [result, setResult] = useState<{scope: string; key: string; failed: boolean; expired?: boolean; invalid?: boolean} | null>(null);
  const keys = catalogQueries(value.city_id, value.zone_id);
  const key = keys.filter(item => item !== null).join('|');
  const current = data.scope === scope ? data : undefined;
  const catalogs = keys.map(item => item === null ? undefined : current?.lists.get(item));
  const loading = result?.scope !== scope || result.key !== key;
  const failed = !loading && result.failed;
  const lists = catalogs.map(item => item?.choices ?? []);
  const message: MessageKey | null = failed ? result.expired ? 'buyer.location.expired'
    : result.invalid ? 'buyer.location.invalid' : 'buyer.location.unavailable'
    : loading ? null : catalogs[2]?.choices.length === 0 ? 'buyer.location.emptyAreas'
    : catalogs[1]?.choices.length === 0 ? 'buyer.location.emptyZones'
    : catalogs[0]?.choices.length === 0 ? 'buyer.location.emptyCities' : null;

  useEffect(() => {
    if (cache.current.scope !== scope) cache.current = {scope, lists: new Map()};
    const target = cache.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let active = true;
    onAvailabilityChange?.({state: 'loading', city: false, zone: false, area: false});
    void (async () => {
      try {
        const queries = catalogQueries(value.city_id, value.zone_id);
        for (const query of queries) {
          if (query === null || target.lists.has(query)) continue;
          const params = new URLSearchParams(query);
          const version = target.version ?? (retry === 0 ? value.catalog_version : undefined);
          if (version) params.set('catalog_version', version);
          const queryString = params.toString();
          const response = await fetch(`/api/public/orders/${encodeURIComponent(token)}/pathao-locations${queryString ? `?${queryString}` : ''}`,
            {signal: controller.signal, cache: 'no-store', referrerPolicy: 'no-referrer'});
          if (!response.ok) {
            const error = await response.json() as {error?: {code?: string}};
            throw new Error(error.error?.code === 'PATHAO_CATALOG_EXPIRED' ? 'Catalog expired'
              : error.error?.code === 'PATHAO_LOCATION_INVALID' ? 'Catalog invalid' : 'Catalog unavailable');
          }
          const catalog = await response.json() as LocationCatalog;
          if (catalog.condition !== 'resolved' || !Array.isArray(catalog.choices)) throw new Error('Catalog unavailable');
          if (!active) return;
          if (target.version && catalog.catalog_version !== target.version) throw new Error('Catalog changed');
          target.version = catalog.catalog_version;
          target.lists.set(query, catalog);
          setData({...target, lists: new Map(target.lists)});
          setResult({scope, key: '', failed: false});
        }
        if (!active) return;
        setResult({scope, key, failed: false});
        onAvailabilityChange?.({state: 'ready', city: Boolean(target.lists.get('')?.choices.length),
          zone: Boolean(value.city_id && target.lists.get(`city_id=${value.city_id}`)?.choices.length),
          area: Boolean(value.zone_id && target.lists.get(`city_id=${value.city_id}&zone_id=${value.zone_id}`)?.choices.length),
          catalog_version: target.version});
      } catch (error: unknown) {
        if (active) {
          setResult({scope, key, failed: true, expired: error instanceof Error && error.message === 'Catalog expired',
            invalid: error instanceof Error && error.message === 'Catalog invalid'});
          onAvailabilityChange?.({state: 'unavailable', city: false, zone: false, area: false});
        }
      } finally { clearTimeout(timeout); }
    })();
    return () => {active = false; clearTimeout(timeout); controller.abort();};
  }, [token, scope, key, retry, value.city_id, value.zone_id, value.catalog_version, onAvailabilityChange]);

  return {lists, pending: catalogs.map((item, index) => keys[index] !== null && !item && !failed),
    loading, message, simulated: catalogs[0]?.simulated, version: current?.version,
    retry: () => setRetry(item => item + 1)};
}
