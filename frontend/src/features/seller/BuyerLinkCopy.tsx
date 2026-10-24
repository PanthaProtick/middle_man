import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface BuyerLinkCopyProps {
  portalUrl: string;
  detail?: boolean;
}

export function BuyerLinkCopy({ portalUrl, detail = false }: BuyerLinkCopyProps) {
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
      <button type="button" className={detail ? 'btn btn-primary' : 'btn btn-secondary btn-sm'}
        title="Copy buyer link to clipboard" disabled={status === 'copying'} onClick={() => { void copy(); }}>
        {status === 'copied' ? <Check size={14} /> : <Copy size={14} />}
        <span>{status === 'copied' ? (detail ? 'Copied Buyer Link' : 'Copied!')
          : status === 'copying' ? 'Copying…' : detail ? 'Copy Buyer Link' : 'Copy Link'}</span>
      </button>
      {status === 'failed' && (
        <div role="alert">
          <p>Could not copy the buyer link. Select and copy it below, or retry.</p>
          <input aria-label="Buyer link to copy manually" readOnly value={fullUrl}
            onFocus={event => event.currentTarget.select()} style={{ width: '100%', minWidth: 0 }} />
        </div>
      )}
    </div>
  );
}
