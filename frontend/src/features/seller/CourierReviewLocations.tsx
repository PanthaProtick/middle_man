import { useEffect, useState } from 'react';
import { requestJson } from './api';
import type { Review, ReviewCatalog } from './courierReviewTypes';
import type { LocationChoice, PathaoSelection } from '../buyer/pathaoTypes';

function useChoices(url: string | null, token: string) {
  const scope = `${token}:${url}`;
  const [state, setState] = useState<{ scope: string; choices: LocationChoice[]; failed?: boolean }>();
  useEffect(() => {
    if (!url) return;
    let active = true;
    const controller = new AbortController();
    requestJson<ReviewCatalog>(url, { signal: controller.signal }, token)
      .then(result => { if (active) setState({ scope, choices: result.choices }); })
      .catch(() => { if (active) setState({ scope, choices: [], failed: true }); });
    return () => { active = false; controller.abort(); };
  }, [url, token, scope]);
  const current = url && state?.scope === scope ? state : undefined;
  return {
    choices: current?.choices ?? [],
    loading: url !== null && !current,
    failed: current?.failed ?? false,
  };
}

export function CourierReviewLocations({ path, token, review, value, onChange }: {
  path: string; token: string; review: Review; value: PathaoSelection; onChange: (value: PathaoSelection) => void;
}) {
  const base = `${path}/locations?environment=${review.choices.environment}&expected_version=${review.connection.version}`;
  // Each level owns its request so loading children cannot erase a selected parent.
  const cities = useChoices(base, token);
  const zones = useChoices(value.city_id ? `${base}&city_id=${value.city_id}` : null, token);
  const areas = useChoices(value.city_id && value.zone_id
    ? `${base}&city_id=${value.city_id}&zone_id=${value.zone_id}` : null, token);
  const lists = [cities, zones, areas];
  return <div aria-label="Seller destination selection">
    {lists.some(list => list.failed) && <p role="alert">Location choices unavailable. Reload current review to retry.</p>}
    {(['city_id', 'zone_id', 'area_id'] as const).map((field, index) => <label key={field}>Pathao {['city', 'zone', 'area'][index]}
      <select value={value[field] ?? ''} aria-busy={lists[index].loading}
        disabled={lists[index].loading || lists[index].failed || (index === 1 && !value.city_id) || (index === 2 && !value.zone_id)}
        onChange={event => {
          const id = Number(event.target.value) || undefined;
          onChange(field === 'city_id' ? { city_id: id } : field === 'zone_id'
            ? { city_id: value.city_id, zone_id: id } : { city_id: value.city_id, zone_id: value.zone_id, area_id: id });
        }}><option value="">Choose {['city', 'zone', 'area'][index]}</option>
        {lists[index].choices.map(item => <option value={item.id} key={item.id}>{item.name}{item.home_delivery_available === false ? ' — unsupported' : ''}</option>)}
      </select>
      {lists[index].loading && <span role="status">Loading Pathao {['city', 'zone', 'area'][index]}…</span>}
    </label>)}
  </div>;
}
