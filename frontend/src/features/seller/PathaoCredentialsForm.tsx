import React from 'react';
import { useCourierText } from '../locale/courierCopy';
import { Button, Field, Input } from '../../components';
import type { PathaoEnvironment } from './pathaoTypes';

export interface PathaoCredentialsFormProps {
  credentialsRef: React.RefObject<HTMLFormElement | null>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  connected: boolean;
  disabled: boolean;
  environment: PathaoEnvironment;
}

export function PathaoCredentialsForm({
  credentialsRef,
  onSubmit,
  connected,
  disabled,
  environment,
}: PathaoCredentialsFormProps): React.JSX.Element {
  const t = useCourierText();
  const summaryText = connected ? t('Replace merchant connection') : t('Connect merchant');

  return (
    <details className="pathao-settings-disclosure">
      <summary>{summaryText}</summary>
      <form ref={credentialsRef} onSubmit={onSubmit} autoComplete="off">
        <fieldset disabled={disabled} aria-label={summaryText}>
          {environment !== 'offline' && (
            <>
              <p>{t('Credentials are write-only. Replacing the connection clears pickup and service defaults.')}</p>
              <Field id="pathao-client-id" label={t('Client ID')}>
                <Input name="client_id" type="password" required maxLength={256} autoComplete="off" />
              </Field>
              <Field id="pathao-client-secret" label={t('Client secret')}>
                <Input name="client_secret" type="password" required maxLength={2048} autoComplete="new-password" />
              </Field>
              <Field id="pathao-username" label={t('Merchant email')}>
                <Input name="username" type="email" required maxLength={256} autoComplete="off" />
              </Field>
              <Field id="pathao-password" label={t('Merchant password')}>
                <Input name="password" type="password" required maxLength={2048} autoComplete="new-password" />
              </Field>
            </>
          )}
          <Button variant="primary" size="sm" type="submit" className="pathao-form-submit">
            {environment === 'offline' ? t('Connect simulated account') : t('Verify and save connection')}
          </Button>
        </fieldset>
      </form>
    </details>
  );
}
