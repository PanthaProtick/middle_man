import React, { useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import './ReviewAssistantSidePanel.css';
import { AssistantWorkspaceContext as Context } from './useAssistantWorkspace';
import { useLocale } from '../locale';
import './SellerAssistant.css';
import { useAssistantConversation } from './useAssistantConversation';
import { AssistantWindow } from './AssistantWindow';
import { sellerAssistantCopy } from '../locale/sellerAssistantCopy';
import { createPortal } from 'react-dom';

interface Props { children: React.ReactNode; eligibleOrderIds?: string[]; floating?: boolean }

export function AssistantWorkspace({ children, eligibleOrderIds = [], floating = false }: Props): React.JSX.Element {
  const parent = useContext(Context);
  const setEligible = parent?.setEligible;
  const eligibilityKey = JSON.stringify(eligibleOrderIds);
  useLayoutEffect(() => {
    if (!setEligible) return;
    setEligible(JSON.parse(eligibilityKey) as string[]);
    return () => setEligible([]);
  }, [setEligible, eligibilityKey]);
  return parent ? <>{children}</> : <OwnedWorkspace floating={floating} eligibleOrderIds={eligibleOrderIds}>{children}</OwnedWorkspace>;
}

function OwnedWorkspace({ children, eligibleOrderIds = [], floating = false }: Props): React.JSX.Element {
  const { locale } = useLocale();
  const conversation = useAssistantConversation(locale);
  const [registeredIds, setEligible] = useState<string[] | null>(null);
  const [generalOpen, setGeneralOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [modalTarget, setTarget] = useState<HTMLDivElement | null>(null);
  const [listTarget, setListTarget] = useState<HTMLDivElement | null>(null);
  const [reviewTarget, setReviewTarget] = useState<HTMLDivElement | null>(null);
  const target = modalId ? modalTarget : listTarget;
  const rootRef = useRef<HTMLDivElement>(null);
  const focusOrderId = useRef<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const followModal = useCallback((id: string | null) => {
    if (id) focusOrderId.current = id;
    setModalId(id); setActiveId(current => current && id ? id : current);
  }, []);
  const restoreFocus = useRef(false);
  useLayoutEffect(() => {
    if (activeId || generalOpen || !restoreFocus.current) return;
    restoreFocus.current = false;
    const frame = requestAnimationFrame(() => {
      const orderTrigger = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-review-order]') ?? []).find(button => button.dataset.reviewOrder === focusOrderId.current);
      const fallback = target?.closest('dialog')?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]') ?? orderTrigger ??
        rootRef.current?.querySelector<HTMLButtonElement>('button');
      if (opener.current?.isConnected && !opener.current.closest('[hidden]') &&
        (!modalId || opener.current.closest('dialog') === target?.closest('dialog'))) opener.current.focus();
      else fallback?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [activeId, generalOpen, modalId, target]);
  const close = useCallback((returnFocus = true) => {
    restoreFocus.current = returnFocus;
    setActiveId(null);
    setGeneralOpen(false);
  }, []);
  if (activeId && !(registeredIds ?? eligibleOrderIds).includes(activeId)) setActiveId(null);
  const showGeneral = () => { setActiveId(null); setGeneralOpen(true); };
  const launcher = <button type="button" className="btn btn-primary seller-assistant-launcher"
    data-testid="seller-assistant-launcher" aria-expanded={Boolean(activeId || generalOpen)}
    onClick={event => { opener.current = event.currentTarget; showGeneral(); }}>
    {sellerAssistantCopy[conversation.locale].title}
  </button>;
  return <Context.Provider value={{activeId, modalId, target: floating ? reviewTarget : target, setTarget, close,
    open: (id, trigger) => { focusOrderId.current = id; opener.current = trigger; setGeneralOpen(false); setActiveId(id); },
    followModal, setEligible, floating, showGeneral, isOpen: Boolean(activeId || generalOpen),
    conversationLocale: floating ? conversation.locale : undefined,
  }}>
    <div ref={rootRef} className={`assistant-workspace${floating ? ' seller-assistant-workspace' : ''}${activeId || generalOpen ? ' assistant-workspace-open' : ''}`}>
      <div className="assistant-orders">{children}</div>
      {!modalId && <div className="assistant-slot" ref={setListTarget} />}
      {floating && (modalId ? target && createPortal(launcher, target) : launcher)}
      {floating && (activeId || generalOpen) && <AssistantWindow target={target} conversation={conversation}
        reviewing={Boolean(activeId)} close={close} showGeneral={showGeneral} setReviewTarget={setReviewTarget} />}
    </div>
  </Context.Provider>;
}
