import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import { Button } from '../../components/Button';

interface Props {
  state: 'signedOut' | 'loading' | 'error';
  errorText?: string | null;
  onSignIn?: () => void;
  onRetry: () => void;
}

export function WorkspaceState({ state, errorText, onSignIn, onRetry }: Props): React.JSX.Element {
  const text = sellerCopy[useLocale().locale];
  if (state === 'signedOut') {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '420px', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '12px', fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>
            {text.signInTitle}
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem', lineHeight: 1.6 }}>
            {text.signInHelp}
          </p>
          <Button
            type="button"
            variant="primary"
            disabled={!onSignIn}
            onClick={() => onSignIn?.()}
          >
            {text.signIn}
          </Button>
          {!onSignIn && (
            <p style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {text.configure}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="card" role="status" style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw size={28} className="spin" style={{ color: 'var(--primary-accent)', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>{text.loading}</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="card" role="alert" style={{ padding: '36px', textAlign: 'center' }}>
        <AlertCircle size={32} style={{ color: 'var(--rose-accent)', margin: '0 auto 12px' }} />
        <h4 style={{ color: 'var(--rose-accent)', marginBottom: '8px' }}>{text.error}</h4>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{errorText}</p>
        <Button variant="primary" size="sm" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" /> {text.retry}
        </Button>
      </div>
    );
  }

  throw new Error('Unknown workspace state');
}
