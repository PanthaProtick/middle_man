import { useState } from 'react';
import type { CourierMessage } from '../locale/courierCopy';
import { useCourierText } from '../locale/courierCopy';

type CopyStatus = 'idle' | 'copied' | 'failed';

export function CourierCopyField({ label, fallbackLabel, value, copiedLabel, className }: {
  label: CourierMessage;
  fallbackLabel: CourierMessage;
  value: string;
  copiedLabel?: CourierMessage;
  className?: string;
}) {
  const t = useCourierText();
  const [status, setStatus] = useState<CopyStatus>('idle');

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return <div className={['courier-copy', className].filter(Boolean).join(' ')}>
    <button className="btn btn-secondary btn-sm" type="button" onClick={() => void copy()}>
      {t(label)}
    </button>
    <span className="courier-copy-status" role="status">
      {status === 'copied' ? t(copiedLabel ?? 'Copied') : null}
      {status === 'failed' ? t('Copy failed. Select and copy manually.') : null}
    </span>
    {status === 'failed' && <label className="courier-copy-fallback">
      <span>{t(fallbackLabel)}</span>
      <textarea readOnly value={value} rows={Math.min(8, value.split('\n').length + 1)}
        onFocus={event => event.currentTarget.select()} />
    </label>}
  </div>;
}
