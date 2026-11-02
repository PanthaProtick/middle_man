import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useLocale } from '../locale/context';
import { buyerLinkCopy } from '../locale/buyerLinkCopy';

interface BuyerLinkCopyProps {
  portalUrl: string;
  detail?: boolean;
}

export function BuyerLinkCopy({ portalUrl, detail = false }: BuyerLinkCopyProps) {
  const { locale } = useLocale();
  const text = buyerLinkCopy[locale];
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const fullUrl = `${window.location.origin}${portalUrl}`;

  useEffect(() => {
    if (status !== 'copied') return;
    const timer = setTimeout(() => setStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(fullUrl);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <div>
      <button
        type="button"
        className={detail ? 'btn btn-primary' : 'btn btn-secondary btn-sm'}
        title={text.copyTitle}
        disabled={status === 'copying'}
        onClick={() => { void copy(); }}
        style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        {status === 'copied' ? <Check size={14} /> : <Copy size={14} />}
        <span role="status" aria-live="polite">
          {status === 'copied' ? (detail ? text.copiedDetail : text.copied)
            : status === 'copying' ? text.copying : detail ? text.copyDetail : text.copy}
        </span>
      </button>
      {status === 'failed' && (
        <div role="alert" style={{ marginTop: '8px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.85rem' }}>{text.copyFailed}</p>
          <input
            aria-label={text.manual}
            readOnly
            value={fullUrl}
            onFocus={event => event.currentTarget.select()}
            style={{ width: '100%', minWidth: 0, minHeight: '44px', padding: '8px 12px', boxSizing: 'border-box' }}
          />
        </div>
      )}
    </div>
  );
}
