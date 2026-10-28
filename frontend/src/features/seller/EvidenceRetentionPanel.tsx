import { useLocale } from '../locale/context';
import { historyText, historyError, cleanupFeedback } from '../locale/historyCopy';
import { formatCount, formatBangladeshDateTime } from '../locale/format';
import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Trash2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { RetentionStatusResponse, RetentionCleanupResponse } from './types';
import { fetchRetentionStatus, runRetentionCleanup } from './retentionApi';

interface EvidenceRetentionPanelProps {
  token?: string;
}

export function EvidenceRetentionPanel({ token }: EvidenceRetentionPanelProps): React.JSX.Element {
  const { locale } = useLocale();
  const tr = (text: string) => historyText(locale, text);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningCleanup, setRunningCleanup] = useState<boolean>(false);
  const [status, setStatus] = useState<RetentionStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<RetentionCleanupResponse | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRetentionStatus(token);
      setStatus(data);
    } catch (err) {
      setError(historyError(err, 'Failed to load retention status'));
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
          setError(historyError(err, 'Failed to load retention status'));
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
      setFeedback(result);
      await loadStatus();
    } catch (err) {
      setError(historyError(err, 'Failed to execute raw evidence cleanup'));
    } finally {
      setRunningCleanup(false);
    }
  };

  if (loading && !status) {
    return (
      <div lang={locale} className="isolated-section" style={{ color: 'var(--text-secondary)' }}>
        <p role="status">{tr("Loading evidence retention status…")}</p>
      </div>
    );
  }

  const hasOverdue = status ? status.overdue_count > 0 : false;
  const hasFailed = status ? status.failed_count > 0 : false;

  return (
    <section
      lang={locale}
      aria-label={tr("Raw evidence retention and cleanup")}
      className="isolated-section"
    >
      <div className="isolated-section-header">
        <div>
          <h4 className="isolated-section-title">
            <Shield size={18} /> {tr("30-Day Raw Evidence Retention")}
          </h4>
          <p className="isolated-section-desc">
            {tr("Original raw SMS text and address AI requests/responses are retained for up to 30 days from collection. Reprocessing never resets this deadline. Structured claims, accepted allocations, and COD remain intact after deletion.")}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setLoading(true);
              void loadStatus();
            }}
            disabled={loading || runningCleanup}
            aria-label={tr("Refresh retention status")}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {tr("Refresh")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handleCleanup()}
            disabled={runningCleanup}
            aria-label={tr("Run Evidence Cleanup")}
          >
            <Trash2 size={14} /> {tr(runningCleanup ? 'Running cleanup…' : 'Run Evidence Cleanup')}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: 'var(--rose-accent)', fontSize: '0.85rem', marginBottom: '12px' }}>
          {tr(error)}
        </div>
      )}

      {feedback && (
        <div role="status" style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', color: 'var(--emerald-accent)', fontSize: '0.85rem', marginBottom: '12px' }}>
          {cleanupFeedback(locale, feedback.items_purged, feedback.items_failed, feedback.overdue_remaining)}
        </div>
      )}

      {status && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            <div className="isolated-subcard" style={{ marginBottom: 0 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>{tr("Raw SMS")}</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {formatCount(status.counts.sms_active)} {tr("retained")} / {formatCount(status.counts.sms_purged)} {tr("purged")}
              </strong>
            </div>
            <div className="isolated-subcard" style={{ marginBottom: 0 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>{tr("AI Prompts/Outputs")}</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {formatCount(status.counts.ai_extractions_active)} {tr("retained")} / {formatCount(status.counts.ai_extractions_purged)} {tr("purged")}
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
            {hasOverdue || hasFailed ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--amber-accent)' }}>
                <AlertTriangle size={15} />
                <strong>{formatCount(status.overdue_count)} {tr("raw evidence items overdue")}</strong>
                {hasFailed && <span>({formatCount(status.failed_count)} {tr("storage failure")})</span>}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--emerald-accent)' }}>
                <CheckCircle2 size={15} />
                <strong>{tr("Raw evidence clean")}</strong> {tr("(0 overdue)")}
              </span>
            )}
            {status.last_cleanup_at && (
              <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', fontSize: '0.75rem' }}>
                {tr("Last checked")}: {formatBangladeshDateTime(status.last_cleanup_at, locale)}
              </span>
            )}
          </div>

          {status.overdue_items.length > 0 && (
            <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--amber-accent)', display: 'block', marginBottom: '6px' }}>
                {tr("Pending Deletions")} ({formatCount(status.overdue_items.length)}):
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--amber-accent)' }}>
                {status.overdue_items.map((item) => (
                  <li key={item.evidence_id} style={{ marginBottom: '4px' }}>
                    <strong>{tr(["sms", "address_ai"].includes(item.evidence_type) ? item.evidence_type : "Unknown evidence type; review the record.")}</strong> (ID: {item.evidence_id}) — {tr("Deadline")}: {formatBangladeshDateTime(item.delete_after, locale)} — {tr("Cleanup overdue. Retry cleanup; contact support if it continues.")}
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
