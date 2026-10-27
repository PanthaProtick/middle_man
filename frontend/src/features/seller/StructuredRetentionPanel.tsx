import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { structuredRetention } from './retentionApi';
import type { StructuredRetentionStatus } from './retentionApi';

interface Props {
  token?: string;
  onCleaned?: () => void;
}

export function StructuredRetentionPanel({ token, onCleaned }: Props) {
  const [status, setStatus] = useState<StructuredRetentionStatus | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void structuredRetention(token).then((result) => {
      if (active) setStatus(result);
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : 'Unable to load retention status');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
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
      setError(failure instanceof Error ? failure.message : 'Cleanup unavailable. Please retry.');
    } finally { setBusy(false); }
  }

  return (
    <section className="isolated-section" aria-label="Completed record retention">
      <div className="isolated-section-header" style={{ marginBottom: '10px' }}>
        <div>
          <h3 className="isolated-section-title">
            <ShieldCheck size={18} /> Completed record retention
          </h3>
          <p className="isolated-section-desc">
            Completed personal records are removed after 12 calendar months. Unresolved orders stay available. Used payments remain protected.
          </p>
        </div>
      </div>
      {busy && <p role="status" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading retention status…</p>}
      {error && <p role="alert" style={{ color: 'var(--rose-accent)', fontSize: '0.85rem' }}>{error}</p>}
      {status && (
        <div className="isolated-subcard" style={{ margin: '12px 0' }}>
          <p role="status" style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>
            {status.overdue} overdue · {status.failed} failed{status.standby ? ' · Offline demonstration' : ''}
          </p>
        </div>
      )}
      {removed !== null && (
        <p role="status" style={{ color: 'var(--emerald-accent)', fontSize: '0.85rem' }}>
          Removed {removed} completed records.
        </p>
      )}
      <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => { void retry(); }}>
        {status ? 'Run / retry completed record cleanup' : 'Retry retention status'}
      </button>
    </section>
  );
}
