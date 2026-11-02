import { useLocale } from '../locale/context';
import { historyText, historyError, cleanupFeedback } from '../locale/historyCopy';
import { formatCount, formatBangladeshDateTime } from '../locale/format';
import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Trash2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { RetentionStatusResponse, RetentionCleanupResponse } from './types';
import { fetchRetentionStatus, runRetentionCleanup } from './retentionApi';
import './Retention.css';

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
      <div lang={locale} className="isolated-section" style={{ color: 'var(--color-text-secondary)' }}>
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
            <Shield size={18} aria-hidden="true" /> {tr("30-Day Raw Evidence Retention")}
          </h4>
          <p className="isolated-section-desc">
            {tr("Original raw SMS text is retained for up to 30 days from collection. Reprocessing never resets this deadline. Structured claims, accepted allocations, and COD remain intact after deletion.")}
          </p>
        </div>
        <div className="retention-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm retention-btn"
            onClick={() => {
              setLoading(true);
              void loadStatus();
            }}
            disabled={loading || runningCleanup}
            aria-label={tr("Refresh retention status")}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{tr("Refresh")}</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm retention-btn"
            onClick={() => void handleCleanup()}
            disabled={runningCleanup}
            aria-label={tr("Run Evidence Cleanup")}
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>{tr(runningCleanup ? 'Running cleanup…' : 'Run Evidence Cleanup')}</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="retention-error">
          {tr(error)}
        </div>
      )}

      {feedback && (
        <div role="status" className="retention-feedback">
          {cleanupFeedback(locale, feedback.items_purged, feedback.items_failed, feedback.overdue_remaining)}
        </div>
      )}

      {status && (
        <div>
          <div className="retention-grid">
            <div className="retention-metric-card">
              <span className="retention-metric-label">{tr("Raw SMS")}</span>
              <strong className="retention-metric-val">
                {formatCount(status.counts.sms_active)} {tr("retained")} / {formatCount(status.counts.sms_purged)} {tr("purged")}
              </strong>
            </div>
          </div>

          <div className="retention-status-row">
            {hasOverdue || hasFailed ? (
              <span className="retention-status-pill retention-status-pill--overdue">
                <AlertTriangle size={15} aria-hidden="true" />
                <strong>{formatCount(status.overdue_count)} {tr("raw evidence items overdue")}</strong>
                {hasFailed && <span>({formatCount(status.failed_count)} {tr("storage failure")})</span>}
              </span>
            ) : (
              <span className="retention-status-pill retention-status-pill--clean">
                <CheckCircle2 size={15} aria-hidden="true" />
                <strong>{tr("Raw evidence clean")}</strong> {tr("(0 overdue)")}
              </span>
            )}
            {status.last_cleanup_at && (
              <span className="retention-timestamp">
                {tr("Last checked")}: {formatBangladeshDateTime(status.last_cleanup_at, locale)}
              </span>
            )}
          </div>

          {status.overdue_items.length > 0 && (
            <div className="retention-alert-box">
              <span className="retention-alert-heading">
                {tr("Pending Deletions")} ({formatCount(status.overdue_items.length)}):
              </span>
              <ul className="retention-alert-list">
                {status.overdue_items.map((item) => (
                  <li key={item.evidence_id}>
                    <strong>{tr(item.evidence_type === "sms" ? item.evidence_type : "Unknown evidence type; review the record.")}</strong> (ID: {item.evidence_id}) — {tr("Deadline")}: {formatBangladeshDateTime(item.delete_after, locale)} — {tr("Cleanup overdue. Retry cleanup; contact support if it continues.")}
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
