import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useLocale } from '../locale/context';
import { getConditionExplanation, reviewAssistanceCopy } from '../locale/reviewAssistanceCopy';
import { fetchReviewAssistance, type ReviewAction, type ReviewAssistanceResponse } from './reviewAssistanceApi';
import { ReviewAssistantPanel } from './ReviewAssistantPanel';
import type { SellerOrder } from './types';
import { selectedPreviewCopy } from '../locale/selectedPreviewCopy';

interface ReviewAssistantProps {
  order: SellerOrder;
  token?: string;
  receiptId?: string;
  receiptVersion?: number;
  selectionKey?: string;
  selectionUnavailable?: boolean;
  onAction?: (actionId: ReviewAction) => void;
}

export function ReviewAssistant(props: ReviewAssistantProps): React.JSX.Element | null {
  const { order, token, receiptId, receiptVersion, selectionKey, selectionUnavailable } = props;
  if (!token || order.lifecycle !== 'pending' || order.buyer_revision === null || selectionUnavailable) return null;
  // A new authorized view never inherits content or an in-flight request.
  const key = JSON.stringify([token, order.shop_id, order.id, order.version,
    order.buyer_revision, order.lifecycle, order.review_reasons, receiptId, receiptVersion, selectionKey]);
  return <AuthorizedReviewAssistant key={key} {...props} />;
}

function AuthorizedReviewAssistant({ order, token, receiptId, receiptVersion, onAction }: ReviewAssistantProps): React.JSX.Element {
  const { locale } = useLocale();
  const text = reviewAssistanceCopy[locale];
  const [isOpen, setOpen] = useState(false);
  const [assistance, setAssistance] = useState<ReviewAssistanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const alive = useRef(true);
  const busy = useRef(false);
  const localeRef = useRef(locale);
  useEffect(() => { localeRef.current = locale; }, [locale]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // This interface is always local: reopening/focus/action rechecks authorization
  // and current facts without generation or a persistent content cache.
  const refresh = useCallback(async (actionId?: ReviewAction) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(false);
    try {
      const data = await fetchReviewAssistance(order.id, token, localeRef.current, receiptId);
      if (!alive.current) return;
      if (data.order_id !== order.id || data.order_version !== order.version ||
          data.buyer_revision !== order.buyer_revision || data.lifecycle !== 'pending' ||
          (receiptId && (data.selected_receipt_id !== receiptId ||
            (receiptVersion !== undefined && data.selected_receipt_version !== receiptVersion)))) {
        throw new Error('Review changed');
      }
      setAssistance(previous => previous?.context_token === data.context_token ? previous : data);
      if (actionId && assistance?.context_token === data.context_token &&
          data.suggested_actions.some(action => action.action_id === actionId)) {
        onAction?.(actionId);
      }
    } catch {
      if (alive.current) { setAssistance(null); setError(true); }
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  }, [order.id, order.version, order.buyer_revision, token, receiptId, receiptVersion, assistance, onAction]);

  useEffect(() => {
    if (!isOpen) return;
    const revalidate = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
  }, [isOpen, refresh]);

  return (
    <div style={{ margin: '10px 0' }} data-testid="review-assistant-root">
      <button type="button" className="btn btn-secondary btn-sm" disabled={loading}
        aria-expanded={isOpen} aria-label={text.askAiAria} data-testid="ask-ai-button"
        onClick={() => {
          setOpen(!isOpen);
          if (!isOpen) void refresh();
        }}>
        <Sparkles size={14} /> <span>{text.askAi}</span>
      </button>
      {isOpen && <ReviewAssistantPanel loading={loading} error={error ? text.error : null}
        assistance={assistance}
        explanation={assistance
          ? assistance.locale === locale
            ? assistance.explanation
            : assistance.selected_receipt_id
              ? [selectedPreviewCopy[locale].intro, ...assistance.reason_codes.map(
                code => getConditionExplanation(code, locale),
              )].join(' ')
              : getConditionExplanation(assistance.condition, locale, assistance.explanation)
          : ''}
        locale={locale} onClose={() => setOpen(false)} onRetry={() => void refresh()}
        onAction={actionId => void refresh(actionId)} />}
    </div>
  );
}
