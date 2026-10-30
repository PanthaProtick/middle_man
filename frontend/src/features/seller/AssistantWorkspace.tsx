import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import './ReviewAssistantSidePanel.css';
import { AssistantWorkspaceContext as Context } from './useAssistantWorkspace';

export function AssistantWorkspace({ children, eligibleOrderIds }: { children: React.ReactNode; eligibleOrderIds: string[] }): React.JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [modalTarget, setTarget] = useState<HTMLDivElement | null>(null);
  const [listTarget, setListTarget] = useState<HTMLDivElement | null>(null);
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
    if (activeId || !restoreFocus.current) return;
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
  }, [activeId, modalId, target]);
  const close = useCallback((returnFocus = true) => {
    restoreFocus.current = returnFocus;
    setActiveId(null);
  }, []);
  if (activeId && !eligibleOrderIds.includes(activeId)) setActiveId(null);
  return <Context.Provider value={{activeId, modalId, target, setTarget, close,
    open: (id, trigger) => { focusOrderId.current = id; opener.current = trigger; setActiveId(id); },
    followModal,
  }}>
    <div ref={rootRef} className={activeId ? 'assistant-workspace assistant-workspace-open' : 'assistant-workspace'}>
      <div className="assistant-orders">{children}</div>
      {!modalId && <div className="assistant-slot" ref={setListTarget} />}
    </div>
  </Context.Provider>;
}
