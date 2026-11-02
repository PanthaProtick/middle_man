import { historyError, historyText } from '../locale/historyCopy';
import { useLocale } from '../locale/context';
import { formatCount, formatBangladeshDateTime, formatBdt } from '../locale/format';
import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import { useId, useRef, useState } from 'react';
import type { PaymentAccount } from './types';
import type { ImportResult } from './smsTypes';
import { importSms, fetchSmsImports } from './api';
import './SmsImportPanel.css';

interface Props {
  accounts: PaymentAccount[];
  token?: string;
  onImported: () => void;
  onManual: (accountId: string) => void;
}

type ResultTone = 'emerald' | 'cyan' | 'amber' | 'rose' | 'neutral';

function resultTone(value: string): ResultTone {
  switch (value) {
    case 'imported':
      return 'emerald';
    case 'duplicate':
      return 'cyan';
    case 'conflicting':
    case 'invalid':
    case 'provider_mismatch':
      return 'rose';
    case 'unsupported':
    case 'missing':
    case 'masked':
    case 'ambiguous':
      return 'amber';
    default:
      return 'neutral';
  }
}

export function SmsImportPanel({ accounts, token, onImported, onManual }: Props) {
  const c = usePaymentInboxCopy();
  const { locale } = useLocale();
  const errorId = useId();
  const formatBangladeshTime = (value: string) => formatBangladeshDateTime(value, locale);
  const [accountId, setAccountId] = useState(accounts.find(a => a.is_active)?.id ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const state = (value: string) => ({ imported: c('Imported'), duplicate: c('Duplicate'), unsupported: c('Unsupported'), invalid: c('Invalid'), conflicting: c('Conflicted'), missing: c('Missing fields'), masked: c('masked'), ambiguous: c('Ambiguous'), provider_mismatch: c('Provider mismatch') })[value] ?? c('Needs review');
  const mutation = useRef({ payload: '', key: '' });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const messages = text.trim().split(/\r?\n\s*\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!accountId || messages.length === 0) {
      setError('Select a receiving account and paste incoming payment SMS.');
      return;
    }
    if (messages.length > 50 || new TextEncoder().encode(messages.join('')).length > 65536) {
      setError('Use at most 50 messages and 64 KiB per batch.');
      return;
    }
    const payload = JSON.stringify({ payment_account_id: accountId, messages });
    if (mutation.current.payload !== payload) mutation.current = { payload, key: crypto.randomUUID() };
    setBusy(true);
    try {
      const result = await importSms({ payment_account_id: accountId, messages }, mutation.current.key, token);
      setResults([result]);
      setCursor(null);
      setText('');
      mutation.current = { payload: '', key: '' };
      onImported();
    } catch (err) {
      setError(historyError(err, 'Import failed. Retry the same batch.'));
    } finally {
      setBusy(false);
    }
  }

  async function loadHistory(next?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const history = await fetchSmsImports(next, token);
      setHistoryLoaded(true);
      setResults(prev => next ? [...prev, ...history.items] : history.items);
      setCursor(history.next_cursor);
    } catch (err) {
      setError(historyError(err, 'Could not load import results.'));
    } finally {
      setBusy(false);
    }
  }

  return <section className="isolated-section sms-import-panel" lang={locale} aria-label={c("Import received payment SMS")}>
    <div className="isolated-section-header sms-import-header">
      <div>
        <h4 className="isolated-section-title">{c("Import received payment SMS")}</h4>
        <p className="isolated-section-desc">{c("SMS import guidance")}</p>
      </div>
    </div>
    <form className="sms-import-form" onSubmit={submit} aria-describedby={error ? errorId : undefined}>
      <label className="sms-import-field">
        <span>{c("SMS receiving account")}</span>
        <select aria-label={c("SMS receiving account")} className="form-control" value={accountId} disabled={busy} onChange={e => setAccountId(e.target.value)}>
          <option value="">{c("Select account")}</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.provider} — {a.label} ({a.receiving_number})</option>)}
        </select>
      </label>
      <label className="sms-import-field sms-import-field-message">
        <span>{c("Incoming payment SMS (separate messages with a blank line)")}</span>
        <textarea aria-label={c("Incoming payment SMS")} className="text-area" rows={5} value={text} disabled={busy}
          onChange={e => setText(e.target.value)} />
      </label>
      <p className="sms-import-help">{c("Maximum 50 messages / 64 KiB. Sender digits and payment times are never guessed.")}</p>
      <div className="sms-import-actions">
        <button className="btn btn-primary btn-sm" disabled={busy || !accounts.length} type="submit">
          {busy ? c("Working…") : c("Import SMS")}
        </button>
        <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => loadHistory()}>{c("Previous import results")}</button>
        <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => onManual(accountId)}>{c("Enter manually from payment app")}</button>
      </div>
    </form>
    {error && <p id={errorId} role="alert" className="sms-import-error">{historyText(locale, c(error))}</p>}
    {busy && <p role="status" className="sms-import-status">{c("Processing request…")}</p>}
    <div className="sms-import-results" aria-live="polite">
      {historyLoaded && !busy && !error && results.length === 0 && <p className="sms-import-empty">{c('No previous SMS imports.')}</p>}
      {results.map(result => <div key={result.id} className="sms-import-batch">
        <div className="sms-import-batch-head">
          <p className="sms-import-batch-title">{c("Import")} {result.id}</p>
          {result.created_at && <p className="sms-import-batch-time">{c("Recorded:")} {formatBangladeshTime(result.created_at)}</p>}
        </div>
        <ol className="sms-result-list">{result.items.map(item => {
          const tone = resultTone(item.state);
          return <li key={item.index} className="sms-result-item" data-tone={tone}>
            <div className="sms-result-head">
              <span className="sms-result-index">{c("Message")} {formatCount(item.index + 1)}</span>
              <span className="sms-state-chip" data-tone={tone}>{state(item.state)}</span>
            </div>
            {item.fields && <dl className="sms-result-fields">
              <div><dt>{c("Payment provider")}</dt><dd>{item.fields.provider}</dd></div>
              <div><dt>TrxID</dt><dd>{item.fields.trx_id}</dd></div>
              <div><dt>{c("Amount:")}</dt><dd>{formatBdt(item.fields.amount_minor)}</dd></div>
              <div><dt>{c("Sender:")}</dt><dd>{item.fields.sender_number || c("Unknown")}</dd></div>
              <div><dt>{c("Occurred At:")}</dt><dd>{item.fields.occurred_at ? formatBangladeshTime(item.fields.occurred_at) : c("Unknown time")}</dd></div>
            </dl>}
            {item.issues.length > 0 && <p className="sms-result-note">{c("Review in the payment app and enter manually.")}</p>}
            {item.order_ids?.length > 0 && <p className="sms-result-orders">{c("Confirmed orders:")} {item.order_ids.join(', ')}</p>}
          </li>;
        })}</ol>
      </div>)}
    </div>
    {cursor && <button type="button" className="btn btn-secondary btn-sm sms-import-more" disabled={busy} onClick={() => loadHistory(cursor)}>{c("More import results")}</button>}
  </section>;
}
