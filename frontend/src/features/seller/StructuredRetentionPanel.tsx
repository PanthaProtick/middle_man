import { useEffect, useState } from 'react';
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

  return <section className="card" style={{ padding: '24px', marginTop: '16px' }} aria-label="Completed record retention">
    <h3>Completed record retention</h3>
    <p>Completed personal records are removed after 12 calendar months. Unresolved orders stay available. Used payments remain protected.</p>
    {busy && <p role="status">Loading retention status…</p>}
    {error && <p role="alert">{error}</p>}
    {status && <p role="status">{status.overdue} overdue · {status.failed} failed{status.standby ? ' · Offline demonstration' : ''}</p>}
    {removed !== null && <p role="status">Removed {removed} completed records.</p>}
    <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => { void retry(); }}>
      {status ? 'Run / retry completed record cleanup' : 'Retry retention status'}
    </button>
  </section>;
}
