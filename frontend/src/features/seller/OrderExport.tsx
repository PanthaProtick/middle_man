import { sellerFetch } from './sessionRequest';
import { useId, useEffect, useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import { useLocale } from '../locale/context';
import {
  exportCopy, failureCode, feedbackMessage, summaryText,
  type ExportFeedback, type ExportOrderSummary,
} from '../locale/exportCopy';

export function OrderExport({ orderId, status, token }: {
  orderId?: string; status?: string; token?: string;
}): React.JSX.Element {
  const { locale } = useLocale();
  const text = exportCopy[locale];
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ExportFeedback | null>(null);
  const active = useRef(true);
  // Completion copy follows the language selected when the operation settles.
  const localeRef = useRef(locale);
  const feedbackId = useId();
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function copySummary(id: string) {
    const summary = await requestJson<ExportOrderSummary>(
      `/api/seller/orders/${encodeURIComponent(id)}/summary`, {}, token,
    );
    if (!active.current) return;
    try {
      await navigator.clipboard.writeText(summaryText(summary, localeRef.current));
    } catch {
      if (active.current) setFeedback({ kind: 'error', code: 'clipboard' });
      return;
    }
    if (active.current) setFeedback({ kind: 'copied' });
  }

  async function downloadCsv() {
    const query = status ? `?${new URLSearchParams({ status })}` : '';
    const response = await sellerFetch(`/api/seller/orders/export${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }, token);
    if (!active.current) return;
    if (!response.ok) {
      setFeedback({ kind: 'error', code: failureCode(response.status) });
      return;
    }
    if (response.headers.get('X-Export-Count') === '0') {
      setFeedback({ kind: 'empty' });
      return;
    }
    const blob = await response.blob();
    if (!active.current) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'order-summaries.csv';
    document.body.append(link); link.click(); link.remove();
    // Let the browser consume the URL before releasing the download resource.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback({ kind: 'started' });
  }

  async function run() {
    setBusy(true); setFeedback(null);
    try {
      if (orderId) await copySummary(orderId);
      else await downloadCsv();
    } catch (error) {
      if (!active.current) return;
      setFeedback({
        kind: 'error',
        code: error instanceof SellerApiError ? failureCode(error.status) : 'unknown',
      });
    } finally {
      if (active.current) setBusy(false);
    }
  }

  const message = feedback ? feedbackMessage(feedback, locale) : null;
  const label = busy ? text.preparing
    : orderId ? text.copyDeliverySummary
      : status ? text.downloadFilteredEnglishCsv
        : text.downloadEnglishCsv;

  return (
    <div lang={locale === 'bn' ? 'bn-BD' : 'en'} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy}
          aria-busy={busy}
          aria-describedby={message ? feedbackId : undefined}
          style={{ minHeight: '36px', wordBreak: 'break-word' }}
          onClick={() => void run()}
        >
          {label}
        </button>
      </div>
      <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.4 }}>
        {text.purpose}
      </small>
      {message && (
        <p
          id={feedbackId}
          role={message.failed ? 'alert' : 'status'}
          aria-live={message.failed ? 'assertive' : 'polite'}
          style={{
            margin: '2px 0 0',
            fontSize: '0.8rem',
            color: message.failed ? 'var(--rose-accent)' : 'var(--emerald-accent)',
          }}
        >
          <span aria-hidden="true">{message.failed ? '⚠ ' : '✓ '}</span>
          {message.message}
        </p>
      )}
    </div>
  );
}
