import { formatCount } from '../locale/format';
import { useLocale } from '../locale/context';
import { historyText, historyError } from '../locale/historyCopy';
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { structuredRetention } from './retentionApi';
import type { StructuredRetentionStatus } from './retentionApi';
import './Retention.css';

interface Props {
  token?: string;
  onCleaned?: () => void;
}

export function StructuredRetentionPanel({ token, onCleaned }: Props): React.JSX.Element {
  const { locale } = useLocale();
  const tr = (text: string) => historyText(locale, text);
  const [status, setStatus] = useState<StructuredRetentionStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void structuredRetention(token)
      .then((result) => {
        if (active) setStatus(result);
      })
      .catch((failure: unknown) => {
        if (active) setError(historyError(failure, 'Failed to load retention status'));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const result = await structuredRetention(token, status !== null);
      setStatus(result);
      if (status !== null) {
        setRemoved(result.removed);
        onCleaned?.();
      }
    } catch (failure: unknown) {
      setError(historyError(failure, 'Retention unavailable. Please retry.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="isolated-section" lang={locale} aria-label={tr("Completed record retention")}>
      <div className="isolated-section-header" style={{ marginBottom: '10px' }}>
        <div>
          <h3 className="isolated-section-title">
            <ShieldCheck size={18} aria-hidden="true" /> {tr("Completed record retention")}
          </h3>
          <p className="isolated-section-desc">
            {tr("Completed personal records are removed after 12 calendar months. Unresolved orders stay available. Used payments remain protected.")}
          </p>
        </div>
      </div>
      {busy && <p role="status" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{tr("Loading retention status…")}</p>}
      {error && <p role="alert" className="retention-error">{tr(error)}</p>}
      {status && (
        <div className="retention-structured-status">
          <p role="status" className="retention-structured-status-text">
            {formatCount(status.overdue)} {tr("overdue")} · {formatCount(status.failed)} {tr("failed")}{status.standby ? ` · ${tr('Offline demonstration')}` : ''}
          </p>
        </div>
      )}
      {removed !== null && (
        <p role="status" className="retention-feedback">
          {tr("Removed")} {formatCount(removed)} {tr("completed records.")}
        </p>
      )}
      <button
        className="btn btn-primary btn-sm retention-btn"
        type="button"
        disabled={busy}
        onClick={() => { void retry(); }}
      >
        {tr(status ? 'Run / retry completed record cleanup' : 'Retry retention status')}
      </button>
    </section>
  );
}
