import React from 'react';
import { Bot, AlertCircle, X, ChevronRight } from 'lucide-react';
import type { Locale } from '../locale/storage';
import { getActionLabel, reviewAssistanceCopy } from '../locale/reviewAssistanceCopy';
import { isReviewAction, type ReviewAction, type ReviewAssistanceResponse } from './reviewAssistanceApi';
import { ReviewFactsList } from './ReviewFactsList';
import { SelectedPreviewAdvice } from './SelectedPreviewAdvice';

interface ReviewAssistantPanelProps {
  loading: boolean;
  error: string | null;
  assistance: ReviewAssistanceResponse | null;
  explanation: string;
  locale: Locale;
  onClose: () => void;
  onRetry: () => void;
  onAction?: (actionId: ReviewAction) => void;
}

export function ReviewAssistantPanel({
  loading,
  error,
  assistance,
  explanation,
  locale,
  onClose,
  onRetry,
  onAction,
}: ReviewAssistantPanelProps): React.JSX.Element {
  const text = reviewAssistanceCopy[locale];

  return (
    <div
      role="region"
      aria-label={text.askAi}
      style={{
        marginTop: '8px',
        padding: '12px 14px',
        borderRadius: '8px',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
      }}
      data-testid="review-assistant-panel"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            data-testid="local-guidance-badge"
            style={{
              fontSize: '0.725rem',
              padding: '2px 8px',
              borderRadius: '9999px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: 'var(--primary-accent, #38bdf8)',
              fontWeight: 600,
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Bot size={12} />
            {text.localBadge}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={text.close}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary, #94a3b8)',
            cursor: 'pointer',
            padding: '2px',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {loading && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
          {text.loading}
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: '0.825rem',
            color: 'var(--rose-accent, #f43f5e)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={onRetry}
            style={{ marginLeft: '8px' }}
          >
            {text.retry}
          </button>
        </div>
      )}

      {!loading && !error && assistance && (
        <div>
          <p
            data-testid="assistance-explanation"
            style={{
              fontSize: '0.85rem',
              lineHeight: '1.45',
              color: 'var(--text-primary, #f8fafc)',
              margin: '0 0 10px 0',
            }}
          >
            {explanation}
          </p>

          {assistance.facts && <ReviewFactsList facts={assistance.facts} locale={locale} />}
          {assistance.selected_receipt_id && <SelectedPreviewAdvice assistance={assistance} locale={locale} />}

          {assistance.suggested_actions && assistance.suggested_actions.some(
            action => isReviewAction(action.action_id),
          ) && (
            <div style={{ marginTop: '10px' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary, #94a3b8)',
                  marginBottom: '6px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {text.suggestedActions}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {assistance.suggested_actions.filter(action => isReviewAction(action.action_id)).map((action) => {
                  const actionLabel = getActionLabel(action.action_id, locale, action.label);
                  return (
                    <button
                      key={action.action_id}
                      type="button"
                      className="btn btn-secondary btn-xs"
                      data-testid={`action-${action.action_id}`}
                      onClick={() => onAction?.(action.action_id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        padding: '4px 8px',
                      }}
                    >
                      <span>{actionLabel}</span>
                      <ChevronRight size={12} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.725rem',
              color: 'var(--text-secondary, #94a3b8)',
              fontStyle: 'italic',
            }}
          >
            {text.advisoryNote}
          </div>
        </div>
      )}
    </div>
  );
}
