import { useState } from 'react';
import { useCourierText } from '../locale/courierCopy';
import { Field, SectionHeader, Select } from '../../components';
import { PathaoConnectionForm } from './PathaoConnectionForm';
import './PathaoSettings.css';

export function PathaoSettings({ token }: { token: string }): React.JSX.Element {
  const t = useCourierText();
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production');

  return (
    <section aria-label={t('Pathao courier settings')} className="pathao-settings-panel">
      <SectionHeader
        headingLevel="h4"
        title={t('Pathao courier account')}
        description={t('Optional: keep creating buyer links and collecting orders without a courier connection.')}
      />
      <Field id="pathao-env-select" label={t('Courier environment')} className="pathao-environment-field">
        <Select
          value={environment}
          onChange={event => setEnvironment(event.target.value === 'sandbox' ? 'sandbox' : 'production')}
        >
          <option value="sandbox">{t('Pathao sandbox')}</option>
          <option value="production">{t('Pathao production')}</option>
        </Select>
      </Field>
      <PathaoConnectionForm key={`${token}:${environment}`} token={token} environment={environment} />
    </section>
  );
}
