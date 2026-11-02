import React from 'react';
import { Bot, AlertCircle, X, ChevronRight } from 'lucide-react';
import type { Locale } from '../locale/storage';
import { getActionLabel, reviewAssistanceCopy } from '../locale/reviewAssistanceCopy';
import { isReviewAction, type ReviewAction, type ReviewAssistanceResponse } from './reviewAssistanceApi';
import { ReviewFactsList } from './ReviewFactsList';
import { SelectedPreviewAdvice } from './SelectedPreviewAdvice';
import { reviewGenerationCopy } from '../locale/reviewGenerationCopy';

interface ReviewAssistantPanelProps {
  loading: boolean;
  error: string | null;
  assistance: ReviewAssistanceResponse | null;
  explanation: string;
  locale: Locale;
  onClose: () => void;
  onRetry: () => void;
  onGenerate?: () => void;
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
  onGenerate,
  onAction,
}: ReviewAssistantPanelProps): React.JSX.Element {
  const text = reviewAssistanceCopy[locale];
  const generated = assistance?.source === 'generated' && assistance.locale === locale;
  const generationText = reviewGenerationCopy[locale];

  return (
    <div
      role="region"
      aria-label={text.askAi}
      className="review-assistant-panel"
      data-testid="review-assistant-panel"
    >
      <div className="review-panel-header">
        <div className="review-panel-badges">
          <span
            data-testid="local-guidance-badge"
            className={`review-guidance-badge${generated ? ' is-generated' : ''}`}
          >
            <Bot size={14} />
            {generated ? generationText.generated : text.localBadge}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={text.close}
          className="review-panel-close"
        >
          <X size={16} />
        </button>
      </div>

      {loading && (
        <div className="review-loading-state">
          {text.loading}
        </div>
      )}

      {assistance?.fallback_status && <p role="status">{generationText[assistance.fallback_status]}</p>}
      {assistance && !generated && (
        <button
          type="button"
          className="btn btn-secondary review-action-button"
          data-testid="generate-review"
          disabled={loading}
          onClick={onGenerate}
        >
          {generationText.generate}
        </button>
      )}

      {error && (
        <div className="review-error-state">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRetry}
          >
            {text.retry}
          </button>
        </div>
      )}

      {!loading && !error && assistance && (
        <div>
          <p
            data-testid="assistance-explanation"
            className="review-assistance-explanation"
          >
            {explanation}
          </p>

          {assistance.facts && <ReviewFactsList facts={assistance.facts} locale={locale} />}
          {assistance.selected_receipt_id && <SelectedPreviewAdvice assistance={assistance} locale={locale} />}

          {assistance.suggested_actions && assistance.suggested_actions.some(
            action => isReviewAction(action.action_id),
          ) && (
            <div className="review-actions-section">
              <div className="review-actions-title">
                {text.suggestedActions}
              </div>
              <div className="review-actions-list">
                {assistance.suggested_actions.filter(action => isReviewAction(action.action_id)).map((action) => {
                  const actionLabel = getActionLabel(action.action_id, locale, action.label);
                  return (
                    <button
                      key={action.action_id}
                      type="button"
                      className="btn btn-secondary review-action-button"
                      data-testid={`action-${action.action_id}`}
                      onClick={() => onAction?.(action.action_id)}
                    >
                      <span>{actionLabel}</span>
                      <ChevronRight size={14} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="review-advisory-note">
            {text.advisoryNote}
          </div>
        </div>
      )}
    </div>
  );
}
