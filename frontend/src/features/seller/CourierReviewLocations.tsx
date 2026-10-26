import { useEffect, useState } from 'react';
import { requestJson } from './api';
import type { Review, ReviewCatalog } from './courierReviewTypes';
import type { LocationChoice, PathaoSelection } from '../buyer/pathaoTypes';

export function CourierReviewLocations({ path, token, review, value, onChange }: {
  path: string; token: string; review: Review; value: PathaoSelection; onChange: (value: PathaoSelection) => void;
}) {
  const scope = `${review.token}:${value.city_id}:${value.zone_id}`;
  const [state, setState] = useState<{ scope: string; lists: LocationChoice[][]; failed?: boolean }>();
  useEffect(() => {
    let active = true;
    const base = `${path}/locations?environment=${review.choices.environment}&expected_version=${review.connection.version}`;
    const load = async (query: string) => (await requestJson<ReviewCatalog>(base + query, {}, token)).choices;
    void (async () => {
      try {
        const cities = await load('');
        const zones = value.city_id ? await load(`&city_id=${value.city_id}`) : [];
        const areas = value.city_id && value.zone_id ? await load(`&city_id=${value.city_id}&zone_id=${value.zone_id}`) : [];
        if (active) setState({ scope, lists: [cities, zones, areas] });
      } catch { if (active) setState({ scope, lists: [[], [], []], failed: true }); }
    })();
    return () => { active = false; };
  }, [path, token, review.token, review.choices.environment, review.connection.version, value.city_id, value.zone_id, scope]);
  const lists = state?.scope === scope ? state.lists : [[], [], []];
  return <div aria-label="Seller destination selection">
    {state?.failed && <p role="alert">Location choices unavailable. Reload current review to retry.</p>}
    {(['city_id', 'zone_id', 'area_id'] as const).map((field, index) => <label key={field}>Pathao {['city', 'zone', 'area'][index]}
      <select value={value[field] ?? ''} disabled={state?.scope !== scope || (index === 1 && !value.city_id) || (index === 2 && !value.zone_id)}
        onChange={event => {
          const id = Number(event.target.value) || undefined;
          onChange(field === 'city_id' ? { city_id: id } : field === 'zone_id'
            ? { city_id: value.city_id, zone_id: id } : { city_id: value.city_id, zone_id: value.zone_id, area_id: id });
        }}><option value="">Choose {['city', 'zone', 'area'][index]}</option>
        {lists[index].map(item => <option value={item.id} key={item.id}>{item.name}{item.home_delivery_available === false ? ' — unsupported' : ''}</option>)}
      </select>
    </label>)}
  </div>;
}
