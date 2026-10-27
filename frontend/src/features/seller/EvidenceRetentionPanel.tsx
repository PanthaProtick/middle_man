import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Trash2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { RetentionStatusResponse } from './types';
import { fetchRetentionStatus, runRetentionCleanup } from './retentionApi';

interface EvidenceRetentionPanelProps {
  token?: string;
}

export function EvidenceRetentionPanel({ token }: EvidenceRetentionPanelProps): React.JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [runningCleanup, setRunningCleanup] = useState<boolean>(false);
  const [status, setStatus] = useState<RetentionStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRetentionStatus(token);
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load retention status');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    fetchRetentionStatus(token)
      .then((data) => {
        if (active) {
          setStatus(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load retention status');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleCleanup = async (): Promise<void> => {
    try {
      setRunningCleanup(true);
      setError(null);
      setFeedback(null);
      const result = await runRetentionCleanup(token);
      setFeedback(
        `Purged ${result.items_purged} raw items (${result.items_failed} failed, ${result.overdue_remaining} overdue remaining).`,
      );
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute raw evidence cleanup');
    } finally {
      setRunningCleanup(false);
    }
  };

  if (loading && !status) {
    return (
      <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        <p role="status">Loading evidence retention status…</p>
      </div>
    );
  }

  const hasOverdue = status ? status.overdue_count > 0 : false;
  const hasFailed = status ? status.failed_count > 0 : false;

  return (
    <section
      aria-label="Raw evidence retention and cleanup"
      style={{
        padding: '16px',
        background: 'var(--bg-surface)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        marginTop: '20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ color: 'var(--primary-accent)', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield size={16} /> 30-Day Raw Evidence Retention
        </h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setLoading(true);
              void loadStatus();
            }}
            disabled={loading || runningCleanup}
            aria-label="Refresh retention status"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handleCleanup()}
            disabled={runningCleanup}
            aria-label="Run Evidence Cleanup"
          >
            <Trash2 size={14} /> {runningCleanup ? 'Running cleanup…' : 'Run Evidence Cleanup'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Original raw SMS text and address AI requests/responses are retained for up to 30 days from collection. Reprocessing never resets this deadline. Structured claims, accepted allocations, and COD remain intact after deletion.
      </p>

      {error && (
        <div role="alert" style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: 'var(--rose-accent)', fontSize: '0.85rem', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {feedback && (
        <div role="status" style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', color: 'var(--emerald-accent)', fontSize: '0.85rem', marginBottom: '12px' }}>
          {feedback}
        </div>
      )}

      {status && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Raw SMS</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {status.counts.sms_active} retained / {status.counts.sms_purged} purged
              </strong>
            </div>
            <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>AI Prompts/Outputs</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {status.counts.ai_extractions_active} retained / {status.counts.ai_extractions_purged} purged
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            {hasOverdue || hasFailed ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--amber-accent)' }}>
                <AlertTriangle size={15} />
                <strong>{status.overdue_count} raw evidence items overdue</strong>
                {hasFailed && <span>({status.failed_count} storage failure)</span>}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--emerald-accent)' }}>
                <CheckCircle2 size={15} />
                <strong>Raw evidence clean</strong> (0 overdue)
              </span>
            )}
            {status.last_cleanup_at && (
              <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', fontSize: '0.75rem' }}>
                Last checked: {new Date(status.last_cleanup_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {status.overdue_items.length > 0 && (
            <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--amber-accent)', display: 'block', marginBottom: '6px' }}>
                Pending Deletions ({status.overdue_items.length}):
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--amber-accent)' }}>
                {status.overdue_items.map((item) => (
                  <li key={item.evidence_id} style={{ marginBottom: '4px' }}>
                    <strong>{item.evidence_type}</strong> (ID: {item.evidence_id}) — Deadline: {new Date(item.delete_after).toLocaleDateString()} — {item.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
