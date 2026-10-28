import { historyError, historyText } from '../locale/historyCopy';
import { useLocale } from '../locale/context';
import { formatCount, formatBangladeshDateTime, formatBdt } from '../locale/format';
import { usePaymentInboxCopy } from '../locale/paymentInboxCopy';
import { useId, useRef, useState } from 'react';
import type { PaymentAccount } from './types';
import type { ImportResult } from './smsTypes';
import { importSms, fetchSmsImports } from './api';

interface Props {
  accounts: PaymentAccount[];
  token?: string;
  onImported: () => void;
  onManual: (accountId: string) => void;
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
      setResults(prev => next ? [...prev, ...history.items] : history.items);
      setCursor(history.next_cursor);
    } catch (err) {
      setError(historyError(err, 'Could not load import results.'));
    } finally {
      setBusy(false);
    }
  }

  return <section className="isolated-section" lang={locale} aria-label={c("Import received payment SMS")} style={{ marginBottom: 20 }}>
    <div className="isolated-section-header" style={{ marginBottom: 12 }}>
      <div>
        <h4 className="isolated-section-title">{c("Import received payment SMS")}</h4>
        <p className="isolated-section-desc">{c("SMS import guidance")}</p>
      </div>
    </div>
    <form onSubmit={submit} aria-describedby={error ? errorId : undefined}>
      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '10px' }}>{c("SMS receiving account")}
        <select aria-label={c("SMS receiving account")} className="form-control" style={{ marginTop: '4px', maxWidth: '420px' }} value={accountId} disabled={busy} onChange={e => setAccountId(e.target.value)}>
          <option value="">{c("Select account")}</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.provider} — {a.label} ({a.receiving_number})</option>)}
        </select>
      </label>
      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px' }}>{c("Incoming payment SMS (separate messages with a blank line)")}
        <textarea aria-label={c("Incoming payment SMS")} className="text-area" rows={5} value={text} disabled={busy}
          style={{ display: 'block', width: '100%', marginTop: '4px' }} onChange={e => setText(e.target.value)} />
      </label>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 12px' }}>{c("Maximum 50 messages / 64 KiB. Sender digits and payment times are never guessed.")}</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" disabled={busy || !accounts.length} type="submit">
          {busy ? c("Working…") : c("Import SMS")}
        </button>
        <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => loadHistory()}>{c("Previous import results")}</button>
        <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => onManual(accountId)}>{c("Enter manually from payment app")}</button>
      </div>
    </form>
    {error && <p id={errorId} role="alert" style={{ marginTop: '12px', color: 'var(--rose-accent)' }}>{historyText(locale, c(error))}</p>}
    {busy && <p role="status" style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>{c("Processing request…")}</p>}
    <div aria-live="polite" style={{ marginTop: results.length > 0 ? '16px' : 0 }}>
      {results.map(result => <div key={result.id} className="isolated-subcard">
        <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: '0 0 8px' }}>{c("Import")} {result.id}</p>
        <ol style={{ paddingLeft: '20px', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>{result.items.map(item => <li key={item.index} style={{ marginBottom: '4px' }}>
          {c("Message")} {formatCount(item.index + 1)}: <strong style={{ color: item.state === 'imported' ? 'var(--emerald-accent)' : 'var(--amber-accent)' }}>{state(item.state)}</strong>
          {item.issues.length > 0 && <span> — {c("Review in the payment app and enter manually.")}</span>}
          {item.fields && <span> — {item.fields.provider} / {item.fields.trx_id} / {formatBdt(item.fields.amount_minor)} / {item.fields.sender_number} / {item.fields.occurred_at ? formatBangladeshTime(item.fields.occurred_at) : c("Unknown time")}</span>}
          {item.order_ids?.length > 0 && <span> — {c("Confirmed orders:")} {item.order_ids.join(', ')}</span>}
        </li>)}</ol>
      </div>)}
    </div>
    {cursor && <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }} disabled={busy} onClick={() => loadHistory(cursor)}>{c("More import results")}</button>}
  </section>;
}
