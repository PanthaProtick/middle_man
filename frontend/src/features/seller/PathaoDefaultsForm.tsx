import React from 'react';
import { useCourierText } from '../locale/courierCopy';
import { Button, Field, Select } from '../../components';
import type { PathaoDeliveryType, PathaoStores } from './pathaoTypes';

export interface PathaoDefaultsFormProps {
  busy: boolean;
  stores?: PathaoStores;
  pickup: string;
  setPickup: (val: string) => void;
  service: PathaoDeliveryType;
  setService: (val: PathaoDeliveryType) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function PathaoDefaultsForm({
  busy,
  stores,
  pickup,
  setPickup,
  service,
  setService,
  onSubmit,
}: PathaoDefaultsFormProps): React.JSX.Element {
  const t = useCourierText();

  return (
    <details className="pathao-settings-disclosure">
      <summary>{t('Courier defaults')}</summary>
      <form data-defaults onSubmit={onSubmit}>
        <fieldset disabled={busy || !stores} aria-label={t('Courier defaults')}>
          {stores?.stores.length === 0 && <p>{t('No active pickup stores. Add one in Pathao, then reload settings.')}</p>}
          <Field id="pathao-pickup-store" label={t('Pickup store')}>
            <Select name="pickup" value={pickup} required onChange={event => setPickup(event.target.value)}>
              <option value="">{t('Choose a pickup store')}</option>
              {stores?.stores.map(store => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="pathao-delivery-service" label={t('Delivery service')}>
            <Select value={service} onChange={event => setService(event.target.value === '12' ? 12 : 48)}>
              <option value="48">{t('Normal delivery (48)')}</option>
              <option value="12">{t('On-demand delivery (12)')}</option>
            </Select>
          </Field>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={!pickup || !stores?.stores.length}
            className="pathao-form-submit"
          >
            {t('Save courier defaults')}
          </Button>
        </fieldset>
      </form>
    </details>
  );
}
