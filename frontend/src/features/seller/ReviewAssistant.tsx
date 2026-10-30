import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAssistantWorkspace } from './useAssistantWorkspace';
import { Sparkles } from 'lucide-react';
import { useLocale } from '../locale/context';
import { getConditionExplanation, reviewAssistanceCopy } from '../locale/reviewAssistanceCopy';
import { fetchReviewAssistance, type ReviewAction, type ReviewAssistanceResponse } from './reviewAssistanceApi';
import { ReviewAssistantPanel } from './ReviewAssistantPanel';
import type { SellerOrder } from './types';
import { selectedPreviewCopy } from '../locale/selectedPreviewCopy';

interface ReviewAssistantProps {
  order: SellerOrder;
  withinModal?: boolean;
  token?: string;
  receiptId?: string;
  receiptVersion?: number;
  selectionKey?: string;
  selectionUnavailable?: boolean;
  onAction?: (actionId: ReviewAction) => void;
}

export function ReviewAssistant(props: ReviewAssistantProps): React.JSX.Element | null {
  const { order, token, receiptId, receiptVersion, selectionKey, selectionUnavailable } = props;
  if (!token || order.lifecycle !== 'pending' || order.buyer_revision === null) return null;
  // A new authorized view never inherits content or an in-flight request.
  const key = JSON.stringify([token, order.shop_id, order.id, order.version,
    order.buyer_revision, order.lifecycle, order.review_reasons, receiptId, receiptVersion, selectionKey, selectionUnavailable]);
  return <AuthorizedReviewAssistant key={key} {...props} />;
}

function AuthorizedReviewAssistant({ order, token, receiptId, receiptVersion, onAction, withinModal = false, selectionUnavailable }: ReviewAssistantProps): React.JSX.Element {
  const { locale } = useLocale();
  const text = reviewAssistanceCopy[locale];
  const workspace = useAssistantWorkspace();
  const [localOpen, setLocalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const inModal = withinModal;
  const isOpen = workspace ? workspace.activeId === order.id &&
    (workspace.modalId ? inModal : !inModal) : localOpen;
  const workspaceClose = workspace?.close;
  const close = useCallback((returnFocus = true) => {
    if (workspaceClose) workspaceClose(returnFocus);
    else { setLocalOpen(false); if (returnFocus) triggerRef.current?.focus(); }
  }, [workspaceClose]);
  const [assistance, setAssistance] = useState<ReviewAssistanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const alive = useRef(true);
  const busy = useRef(false);
  const requestEpoch = useRef(0);
  useEffect(() => {
    requestEpoch.current += 1;
    busy.current = false;
    setLoading(false);
    setError(false);
  }, [isOpen]);
  const localeRef = useRef(locale);
  useEffect(() => { localeRef.current = locale; }, [locale]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Reopening/focus/actions recheck facts without generation or persistent caching.
  const refresh = useCallback(async (actionId?: ReviewAction, generate = false) => {
    if (busy.current || selectionUnavailable) return;
    const epoch = requestEpoch.current;
    busy.current = true;
    setLoading(true);
    setError(false);
    try {
      const requestedLocale = localeRef.current;
      const data = await fetchReviewAssistance(order.id, token, requestedLocale, receiptId, generate);
      if (!alive.current || epoch !== requestEpoch.current) return;
      if (generate && requestedLocale !== localeRef.current) return;
      if (data.order_id !== order.id || data.order_version !== order.version ||
          data.buyer_revision !== order.buyer_revision || data.lifecycle !== 'pending' ||
          (receiptId && (data.selected_receipt_id !== receiptId ||
            (receiptVersion !== undefined && data.selected_receipt_version !== receiptVersion)))) {
        throw new Error('Review changed');
      }
      setAssistance(previous => !generate && previous?.context_token === data.context_token &&
        previous.locale === data.locale ? previous : data);
      if (actionId && assistance?.context_token === data.context_token &&
          data.suggested_actions.some(action => action.action_id === actionId)) {
        close(false);
        onAction?.(actionId);
      }
    } catch {
      if (alive.current && epoch === requestEpoch.current) { setAssistance(null); setError(true); }
    } finally {
      if (epoch === requestEpoch.current) {
        busy.current = false;
        if (alive.current) setLoading(false);
      }
    }
  }, [order.id, order.version, order.buyer_revision, token, receiptId, receiptVersion, assistance, onAction, close, selectionUnavailable]);

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

  useEffect(() => {
    if (!isOpen) return;
    void refresh();
    panelRef.current?.focus();
    // Context remounts revalidate local guidance; never generate automatically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopImmediatePropagation(); close();
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  });

  const panel = isOpen && <aside ref={panelRef} tabIndex={-1} className="review-assistant-side-panel"
    aria-label={text.askAi}>
    <h3>{order.product_name}</h3><p>{order.id}</p>
    <button type="button" className={`btn btn-secondary assistant-back${selectionUnavailable ? ' assistant-back-required' : ''}`} onClick={() => close()}>{text.backToOrder}</button>
    {selectionUnavailable ? <div data-testid="review-assistant-panel" role="region" aria-label={text.askAi}>
      <p role="status">{text.receiptUnavailable}</p>
      <button type="button" className="btn btn-secondary" aria-label={text.close} onClick={() => close()}>{text.close}</button>
    </div> : <ReviewAssistantPanel loading={loading} error={error ? text.error : null}
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
        locale={locale} onClose={() => close()} onRetry={() => void refresh()}
        onGenerate={() => void refresh(undefined, true)}
        onAction={actionId => void refresh(actionId)} />}
    </aside>;
  return (
    <div style={{ margin: '10px 0' }} data-testid="review-assistant-root">
      <button ref={triggerRef} type="button" className="btn btn-secondary btn-sm"
        data-review-order={order.id} aria-expanded={isOpen} aria-label={text.askAiAria} data-testid="ask-ai-button"
        onClick={() => {
          if (isOpen) close();
          else if (workspace) workspace.open(order.id, triggerRef.current!);
          else setLocalOpen(true);
        }}>
        <Sparkles size={14} /> <span>{text.askAi}</span>
      </button>
      {workspace ? workspace.target && panel && createPortal(panel, workspace.target) : panel}
    </div>
  );
}

