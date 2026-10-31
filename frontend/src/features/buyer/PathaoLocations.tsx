import { useLocationCatalog } from './useLocationCatalog';
import { useLocale } from '../locale';
import type { LocationAvailability, LocationChoice, PathaoSelection } from './pathaoTypes';

interface Props {
  portalToken: string;
  value: PathaoSelection;
  onChange: (value: PathaoSelection) => void;
  onAvailabilityChange?: (value: LocationAvailability) => void;
  fieldErrors?: Record<string, string>;
  disabled?: boolean;
}
function LocationChoiceSelect({ name, choices, value, disabled, error, required, onChange }: {
  name: 'city' | 'zone' | 'area'; choices: LocationChoice[]; value?: number; disabled: boolean;
  error?: string; required: boolean; onChange: (id?: number) => void;
}) {
  const { t } = useLocale();
  const label = t(`buyer.location.${name}`);
  const id = `pathao_${name}`;
  return <div className="pathao-location-choice">
    <label>{t('buyer.location.choice', {name: label})}<select className="form-control" name={id} value={value ?? ''} disabled={disabled}
      required={required} aria-required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
      onChange={event => onChange(event.target.value ? Number(event.target.value) : undefined)}>
      <option value="">{t('buyer.location.choose', {name: label})}</option>
      {value && !choices.some(item => item.id === value) && <option value={value}>{t('buyer.location.saved', {id: value})}</option>}
      {choices.map(item => <option key={item.id} value={item.id}>{item.name}{item.home_delivery_available === false ? t('buyer.location.unsupportedOption') : ''}</option>)}
    </select></label>
    {error && <div id={`${id}-error`} role="alert" style={{ color: 'var(--rose-accent)', fontSize: '0.75rem' }}>{error}</div>}
  </div>;
}
export function PathaoLocations({ portalToken, value, onChange, onAvailabilityChange, fieldErrors, disabled = false }: Props) {
  const { t, locale } = useLocale();
  const {lists, pending, loading, message, simulated, version, retry} = useLocationCatalog(portalToken, value, onAvailabilityChange);
  return <section className="pathao-locations" lang={locale} aria-label={t('buyer.location.label')} aria-busy={loading}>
    <p>{t('buyer.location.help')}</p>
    {simulated && <p>{t('buyer.location.simulated')}</p>}
    {loading && <p role="status">{t('buyer.location.loading')}</p>}
    {message && <p role="alert">{t(message)}</p>}
    <LocationChoiceSelect name="city" choices={lists[0]} value={value.city_id} disabled={disabled || pending[0]}
      required={lists[0].length > 0} error={fieldErrors?.pathao_city}
      onChange={city_id => onChange(city_id ? {city_id, catalog_version: version} : {})} />
    <LocationChoiceSelect key={value.city_id ?? 'zone'} name="zone" choices={lists[1]} value={value.zone_id}
      disabled={disabled || pending[1] || !value.city_id} required={lists[1].length > 0} error={fieldErrors?.pathao_zone}
      onChange={zone_id => onChange({city_id: value.city_id, catalog_version: version, ...(zone_id ? {zone_id} : {})})} />
    <LocationChoiceSelect key={value.zone_id ?? 'area'} name="area" choices={lists[2]} value={value.area_id}
      disabled={disabled || pending[2] || !value.zone_id || lists[2].length === 0} required={lists[2].length > 0}
      error={fieldErrors?.pathao_area} onChange={area_id => onChange({...value, area_id, catalog_version: version})} />
    <label className="pathao-location-help"><input type="checkbox" checked={value.unsupported ?? false} disabled={disabled}
      onChange={event => onChange({...value, unsupported: event.target.checked})} />{t('buyer.location.unsupported')}</label>
    <div className="pathao-location-actions">
      <button className="btn btn-secondary" type="button" disabled={disabled || loading} onClick={retry}>{t('buyer.location.retry')}</button>
      <button className="btn btn-secondary" type="button" disabled={disabled} onClick={() => onChange({})}>{t('buyer.location.clear')}</button>
    </div>
  </section>;
}
