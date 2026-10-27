import { useRef, useState } from 'react';
import type { PaymentAccount } from './types';
import type { ImportResult } from './smsTypes';
import { importSms, fetchSmsImports, formatBangladeshTime } from './api';

interface Props {
  accounts: PaymentAccount[];
  token?: string;
  onImported: () => void;
  onManual: (accountId: string) => void;
}

export function SmsImportPanel({ accounts, token, onImported, onManual }: Props) {
  const [accountId, setAccountId] = useState(accounts.find(a => a.is_active)?.id ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
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
      setError(err instanceof Error ? err.message : 'Import failed. Retry the same batch.');
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
      setError(err instanceof Error ? err.message : 'Could not load import results.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="isolated-section" aria-label="Import received payment SMS" style={{ marginBottom: 20 }}>
    <div className="isolated-section-header" style={{ marginBottom: 12 }}>
      <div>
        <h4 className="isolated-section-title">Import received payment SMS</h4>
        <p className="isolated-section-desc">Paste seller incoming-payment SMS only. Buyer payment details are claims, not receipt evidence.
          Raw SMS is private with a deletion deadline 30 days after original collection.
          Parsing uses a limited tested format; unsupported bKash and Nagad messages need manual entry.</p>
      </div>
    </div>
    <form onSubmit={submit}>
      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '10px' }}>SMS receiving account
        <select aria-label="SMS receiving account" className="form-control" style={{ marginTop: '4px', maxWidth: '420px' }} value={accountId} disabled={busy} onChange={e => setAccountId(e.target.value)}>
          <option value="">Select account</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.provider} — {a.label} ({a.receiving_number})</option>)}
        </select>
      </label>
      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px' }}>Incoming payment SMS (separate messages with a blank line)
        <textarea aria-label="Incoming payment SMS" className="text-area" rows={5} value={text} disabled={busy}
          style={{ display: 'block', width: '100%', marginTop: '4px' }} onChange={e => setText(e.target.value)} />
      </label>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 12px' }}>Maximum 50 messages / 64 KiB. Sender digits and payment times are never guessed.</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" disabled={busy || !accounts.length} type="submit">
          {busy ? 'Working…' : 'Import SMS'}
        </button>
        <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => loadHistory()}>Previous import results</button>
        <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => onManual(accountId)}>Enter manually from payment app</button>
      </div>
    </form>
    {error && <p role="alert" style={{ marginTop: '12px', color: 'var(--rose-accent)' }}>{error}</p>}
    {busy && <p role="status" style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Processing request…</p>}
    <div aria-live="polite" style={{ marginTop: results.length > 0 ? '16px' : 0 }}>
      {results.map(result => <div key={result.id} className="isolated-subcard">
        <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: '0 0 8px' }}>Import {result.id}</p>
        <ol style={{ paddingLeft: '20px', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>{result.items.map(item => <li key={item.index} style={{ marginBottom: '4px' }}>
          Message {item.index + 1}: <strong style={{ color: item.state === 'imported' ? 'var(--emerald-accent)' : 'var(--amber-accent)' }}>{item.state}</strong>
          {item.issues.length > 0 && <span> — {item.issues.join(', ')}. Review in the payment app and enter manually.</span>}
          {item.fields && <span> — {item.fields.provider} / {item.fields.trx_id} / BDT {(item.fields.amount_minor / 100).toFixed(2)} / {item.fields.sender_number} / {item.fields.occurred_at ? formatBangladeshTime(item.fields.occurred_at) : 'Unknown time'}</span>}
          {item.order_ids?.length > 0 && <span> — Confirmed orders: {item.order_ids.join(', ')}</span>}
        </li>)}</ol>
      </div>)}
    </div>
    {cursor && <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }} disabled={busy} onClick={() => loadHistory(cursor)}>More import results</button>}
  </section>;
}
