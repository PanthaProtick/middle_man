import { useCourierText } from '../locale/courierCopy';
import { CourierReviewLocations } from './CourierReviewLocations';
import type { Review, ReviewChoices } from './courierReviewTypes';

export function CourierReviewChoices({ review, choices, busy, dirty, path, token, identity, onChange, onSave }: {
  review: Review;
  choices: ReviewChoices;
  busy: boolean;
  dirty: boolean;
  path: string;
  token: string;
  identity: string;
  onChange: (choices: ReviewChoices) => void;
  onSave: () => void;
}) {
  const t = useCourierText();
  return <fieldset disabled={busy || review.blockers.includes('ORDER_NOT_CONFIRMED')}>
    <legend>{t("Pickup and delivery choices")}</legend>
    <label>{t("Environment")}<select value={choices.environment} onChange={event => {
      const environment = event.target.value;
      if (environment === 'offline' || environment === 'sandbox' || environment === 'production') {
        onChange({ environment, store_id: null, delivery_type: null, location: {} });
      }
    }}>{(['offline', 'sandbox', 'production'] as const).map(env => <option key={env} value={env}>{t(env)}</option>)}</select></label>
    {choices.environment !== review.choices.environment && <p className="delivery-note">{t("Save the environment change to load its pickup stores and delivery locations.")}</p>}
    <label>{t("Pickup store")}<select value={choices.store_id ?? ''} disabled={choices.environment !== review.choices.environment}
      onChange={event => onChange({ ...choices, store_id: Number(event.target.value) || null })}>
      <option value="">{t("Choose pickup store")}</option>
      {review.stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
    </select></label>
    <label>{t("Delivery service")}<select value={choices.delivery_type ?? ''} onChange={event => {
      const service = Number(event.target.value);
      onChange({ ...choices, delivery_type: service === 48 || service === 12 ? service : null });
    }}><option value="">{t("Choose service")}</option><option value="48">{t("Normal delivery")}</option><option value="12">{t("On-demand delivery")}</option></select></label>
    <p>{t("Destination:")} {[review.location.city_name, review.location.zone_name, review.location.area_name].filter(Boolean).join(' / ') || t('Unresolved')}</p>
    {review.connection.version > 0 && choices.environment === review.choices.environment &&
      <CourierReviewLocations key={`${identity}:${review.token}`} path={path} token={token} review={review} value={choices.location}
        onChange={location => onChange({ ...choices, location })} />}
    <button className="btn btn-secondary" type="button" disabled={!dirty} onClick={onSave}>{t("Save delivery choices")}</button>
  </fieldset>;
}
