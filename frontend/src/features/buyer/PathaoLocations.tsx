import { useEffect, useState } from 'react';
import type { LocationCatalog, LocationChoice, PathaoSelection } from './pathaoTypes';

interface Props {
  portalToken: string;
  value: PathaoSelection;
  onChange: (value: PathaoSelection) => void;
  disabled?: boolean;
}
function SearchChoice({ name, choices, value, disabled, onChange }: {
  name: string; choices: LocationChoice[]; value?: number; disabled: boolean; onChange: (id?: number) => void;
}) {
  const [search, setSearch] = useState('');
  const visible = choices.filter(item => item.id === value || item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <div className="pathao-location-choice">
    <label>Search Pathao {name}<input className="form-control" type="search" value={search} disabled={disabled}
      onChange={event => setSearch(event.target.value)} /></label>
    <label>Pathao {name}<select className="form-control" name={`pathao_${name}`} value={value ?? ''} disabled={disabled}
      onChange={event => { setSearch(''); onChange(event.target.value ? Number(event.target.value) : undefined); }}>
      <option value="">Choose {name}</option>
      {value && !choices.some(item => item.id === value) && <option value={value}>Saved choice (ID {value}); retry to load label</option>}
      {visible.map(item => <option key={item.id} value={item.id}>{item.name}{item.home_delivery_available === false ? ' — unsupported delivery' : ''}</option>)}
    </select></label>
  </div>;
}
export function PathaoLocations({ portalToken, value, onChange, disabled = false }: Props) {
  const [retry, setRetry] = useState(0);
  const scope = JSON.stringify([portalToken, value.city_id, value.zone_id, retry]);
  const [result, setResult] = useState<{scope: string; lists: LocationChoice[][]; message: string; simulated: boolean} | null>(null);
  const loading = result?.scope !== scope;
  const lists = !loading && result ? result.lists : [[], [], []];
  const message = !loading && result ? result.message : '';
  const simulated = !loading && result?.simulated;
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let active = true;
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
          const message = areas && areas.choices.length === 0
            ? 'No area choices are listed. Submit your written address; the seller must verify delivery coverage.'
            : zones && zones.choices.length === 0 ? 'No zones are listed. Submit your written address for seller resolution.' : '';
          setResult({scope, lists: [cities.choices, zones?.choices ?? [], areas?.choices ?? []], message, simulated: cities.simulated});
        }
      } catch {
        if (active) setResult({scope, lists: [[], [], []], simulated: false,
          message: 'Pathao locations are unavailable. You can submit your written address and payment claim for seller resolution. Retry keeps your inputs.'});
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [portalToken, value.city_id, value.zone_id, scope]);
  return <section className="pathao-locations" aria-label="Pathao delivery location" aria-busy={loading}>
    <p>Choose the delivery location if available. Include house, street and delivery directions in the full address below.</p>
    {simulated && <p>Simulated Pathao locations — offline demonstration only.</p>}
    {loading && <p role="status">Loading Pathao locations…</p>}
    {message && <p role="alert">{message}</p>}
    <SearchChoice name="city" choices={lists[0]} value={value.city_id} disabled={disabled || loading}
      onChange={city_id => onChange(city_id ? {city_id} : {})} />
    <SearchChoice key={value.city_id ?? 'zone'} name="zone" choices={lists[1]} value={value.zone_id}
      disabled={disabled || loading || !value.city_id} onChange={zone_id => onChange({city_id: value.city_id, ...(zone_id ? {zone_id} : {})})} />
    <SearchChoice key={value.zone_id ?? 'area'} name="area" choices={lists[2]} value={value.area_id}
      disabled={disabled || loading || !value.zone_id || lists[2].length === 0}
      onChange={area_id => onChange({...value, area_id})} />
    <label className="pathao-location-help"><input type="checkbox" checked={value.unsupported ?? false} disabled={disabled}
      onChange={event => onChange({...value, unsupported: event.target.checked})} />My destination is not supported / needs seller help</label>
    <div className="pathao-location-actions">
      <button className="btn btn-secondary" type="button" disabled={disabled || loading} onClick={() => setRetry(retry + 1)}>Retry location lookup</button>
      <button className="btn btn-secondary" type="button" disabled={disabled} onClick={() => onChange({})}>Clear choices and use written address</button>
    </div>
  </section>;
}
