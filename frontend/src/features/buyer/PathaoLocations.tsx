import { useEffect, useState } from 'react';
import { useLocale, type MessageKey } from '../locale';
import type { LocationAvailability, LocationCatalog, LocationChoice, PathaoSelection } from './pathaoTypes';

interface Props {
  portalToken: string;
  value: PathaoSelection;
  onChange: (value: PathaoSelection) => void;
  onAvailabilityChange?: (value: LocationAvailability) => void;
  fieldErrors?: Record<string, string>;
  disabled?: boolean;
}
function SearchChoice({ name, choices, value, disabled, error, required, onChange }: {
  name: 'city' | 'zone' | 'area'; choices: LocationChoice[]; value?: number; disabled: boolean;
  error?: string; required: boolean; onChange: (id?: number) => void;
}) {
  const { t } = useLocale();
  const label = t(`buyer.location.${name}`);
  const id = `pathao_${name}`;
  const [search, setSearch] = useState('');
  const visible = choices.filter(item => item.id === value || item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <div className="pathao-location-choice">
    <label>{t('buyer.location.search', {name: label})}<input className="form-control" type="search" value={search} disabled={disabled}
      onChange={event => setSearch(event.target.value)} /></label>
    <label>{t('buyer.location.choice', {name: label})}<select className="form-control" name={id} value={value ?? ''} disabled={disabled}
      required={required} aria-required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
      onChange={event => { setSearch(''); onChange(event.target.value ? Number(event.target.value) : undefined); }}>
      <option value="">{t('buyer.location.choose', {name: label})}</option>
      {value && !choices.some(item => item.id === value) && <option value={value}>{t('buyer.location.saved', {id: value})}</option>}
      {visible.map(item => <option key={item.id} value={item.id}>{item.name}{item.home_delivery_available === false ? t('buyer.location.unsupportedOption') : ''}</option>)}
    </select></label>
    {error && <div id={`${id}-error`} role="alert" style={{ color: 'var(--rose-accent)', fontSize: '0.75rem' }}>{error}</div>}
    {search && visible.length === 0 && <p role="status">{t('buyer.location.noMatches')}</p>}
  </div>;
}
export function PathaoLocations({ portalToken, value, onChange, onAvailabilityChange, fieldErrors, disabled = false }: Props) {
  const { t, locale } = useLocale();
  const [retry, setRetry] = useState(0);
  const scope = JSON.stringify([portalToken, value.city_id, value.zone_id, retry]);
  const [result, setResult] = useState<{scope: string; lists: LocationChoice[][]; message: MessageKey | null; simulated: boolean;
    state: LocationAvailability['state']} | null>(null);
  const loading = result?.scope !== scope;
  const lists = !loading && result ? result.lists : [[], [], []];
  const message = !loading && result ? result.message : '';
  const simulated = !loading && result?.simulated;
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let active = true;
    onAvailabilityChange?.({state: 'loading', city: false, zone: false, area: false});
    const load = async (query = ''): Promise<LocationCatalog> => {
      const response = await fetch(`/api/public/orders/${encodeURIComponent(portalToken)}/pathao-locations${query}`,
        {signal: controller.signal, cache: 'no-store', referrerPolicy: 'no-referrer'});
      if (!response.ok) throw new Error('Catalog unavailable');
      const result = await response.json() as LocationCatalog;
      if (result.condition !== 'resolved' || !Array.isArray(result.choices)) throw new Error('Catalog unavailable');
      return result;
    };
    void (async () => {
      try {
        const cities = await load();
        const zones = value.city_id ? await load(`?city_id=${value.city_id}`) : null;
        const areas = value.city_id && value.zone_id ? await load(`?city_id=${value.city_id}&zone_id=${value.zone_id}`) : null;
        if (active) {
          const message: MessageKey | null = areas && areas.choices.length === 0
            ? 'buyer.location.emptyAreas'
            : zones && zones.choices.length === 0 ? 'buyer.location.emptyZones'
            : cities.choices.length === 0 ? 'buyer.location.emptyCities' : null;
          const next = [cities.choices, zones?.choices ?? [], areas?.choices ?? []];
          setResult({scope, lists: next, message, simulated: cities.simulated, state: 'ready'});
          onAvailabilityChange?.({state: 'ready', city: next[0].length > 0,
            zone: Boolean(value.city_id && next[1].length), area: Boolean(value.zone_id && next[2].length)});
        }
      } catch {
        if (active) {
          setResult({scope, lists: [[], [], []], simulated: false,
            message: 'buyer.location.unavailable', state: 'unavailable'});
          onAvailabilityChange?.({state: 'unavailable', city: false, zone: false, area: false});
        }
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [portalToken, value.city_id, value.zone_id, scope, onAvailabilityChange]);
  return <section className="pathao-locations" lang={locale} aria-label={t('buyer.location.label')} aria-busy={loading}>
    <p>{t('buyer.location.help')}</p>
    {simulated && <p>{t('buyer.location.simulated')}</p>}
    {loading && <p role="status">{t('buyer.location.loading')}</p>}
    {message && <p role="alert">{t(message)}</p>}
    <SearchChoice name="city" choices={lists[0]} value={value.city_id} disabled={disabled || loading}
      required={lists[0].length > 0} error={fieldErrors?.pathao_city}
      onChange={city_id => onChange(city_id ? {city_id} : {})} />
    <SearchChoice key={value.city_id ?? 'zone'} name="zone" choices={lists[1]} value={value.zone_id}
      disabled={disabled || loading || !value.city_id} required={lists[1].length > 0} error={fieldErrors?.pathao_zone}
      onChange={zone_id => onChange({city_id: value.city_id, ...(zone_id ? {zone_id} : {})})} />
    <SearchChoice key={value.zone_id ?? 'area'} name="area" choices={lists[2]} value={value.area_id}
      disabled={disabled || loading || !value.zone_id || lists[2].length === 0} required={lists[2].length > 0}
      error={fieldErrors?.pathao_area} onChange={area_id => onChange({...value, area_id})} />
    <label className="pathao-location-help"><input type="checkbox" checked={value.unsupported ?? false} disabled={disabled}
      onChange={event => onChange({...value, unsupported: event.target.checked})} />{t('buyer.location.unsupported')}</label>
    <div className="pathao-location-actions">
      <button className="btn btn-secondary" type="button" disabled={disabled || loading} onClick={() => setRetry(retry + 1)}>{t('buyer.location.retry')}</button>
      <button className="btn btn-secondary" type="button" disabled={disabled} onClick={() => onChange({})}>{t('buyer.location.clear')}</button>
    </div>
  </section>;
}
