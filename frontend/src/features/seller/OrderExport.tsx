import { useId, useEffect, useRef, useState } from 'react';
import { useLocale } from '../locale/context';
import { exportCopy } from '../locale/exportCopy';
import { requestJson } from './api';
import {
  exportFeedbackMessage,
  resolveExportFailure,
  resolveSummaryFailure,
  summaryText,
  type ExportFeedback,
  type ExportOrderSummary,
} from './orderExportSupport';
import { sellerFetch } from './sessionRequest';

export function OrderExport({ orderId, status, token }: {
  orderId?: string; status?: string; token?: string;
}): React.JSX.Element {
  const { locale } = useLocale();
  const text = exportCopy[locale];
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ExportFeedback | null>(null);
  const active = useRef(true);
  const localeRef = useRef(locale);
  const feedbackId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const wasFocusedRef = useRef(false);
  const prevBusyRef = useRef(false);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (prevBusyRef.current && !busy && wasFocusedRef.current) {
      wasFocusedRef.current = false;
      buttonRef.current?.focus();
    }
    prevBusyRef.current = busy;
  }, [busy]);

  async function copySummary(id: string) {
    const summary = await requestJson<ExportOrderSummary>(
      `/api/seller/orders/${encodeURIComponent(id)}/summary`, {}, token,
    );
    if (!active.current) return;
    try {
      await navigator.clipboard.writeText(summaryText(summary, localeRef.current));
    } catch (error) {
      if (active.current) {
        setFeedback({
          kind: 'error',
          code: 'clipboard',
          detail: error instanceof Error ? error.message : undefined,
        });
      }
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
      let detail: string | undefined;
      try {
        const errBody = await response.json();
        detail = typeof errBody?.error?.message === 'string'
          ? errBody.error.message
          : typeof errBody?.detail === 'string'
            ? errBody.detail
            : undefined;
      } catch {
        // Non-JSON error body
      }
      const failure = resolveExportFailure(null, response.status, detail);
      setFeedback({ kind: 'error', code: failure.code, detail: failure.detail });
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
    wasFocusedRef.current = document.activeElement === buttonRef.current;
    setBusy(true); setFeedback(null);
    try {
      if (orderId) await copySummary(orderId);
      else await downloadCsv();
    } catch (error) {
      if (!active.current) return;
      const failure = orderId
        ? resolveSummaryFailure(error)
        : resolveExportFailure(error);
      setFeedback({ kind: 'error', code: failure.code, detail: failure.detail });
    } finally {
      if (active.current) setBusy(false);
    }
  }

  const message = feedback ? exportFeedbackMessage(feedback, locale) : null;
  const label = busy ? text.preparing
    : orderId ? text.copyDeliverySummary
      : status ? text.downloadFilteredEnglishCsv
        : text.downloadEnglishCsv;

  return (
    <div lang={locale === 'bn' ? 'bn-BD' : 'en'} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          ref={buttonRef}
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
        <div style={{ margin: '2px 0 0' }}>
          <p
            id={feedbackId}
            role={message.failed ? 'alert' : 'status'}
            aria-live={message.failed ? 'assertive' : 'polite'}
            style={{
              margin: 0,
              fontSize: '0.8rem',
              color: message.failed ? 'var(--rose-accent)' : 'var(--emerald-accent)',
            }}
          >
            {message.message}
          </p>
          {message.detail && (
            <details style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <summary style={{ cursor: 'pointer' }}>{text.viewTechnicalDetails}</summary>
              <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                {message.detail}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
