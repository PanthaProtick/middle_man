import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { sellerAssistantCopy } from '../locale/sellerAssistantCopy';
import type { AssistantConversation as Conversation } from './useAssistantConversation';
import { AssistantConversation } from './GuidedAssistant';

interface Props {
  target: HTMLDivElement | null;
  conversation: Conversation;
  reviewing: boolean;
  close: () => void;
  showGeneral: () => void;
  setReviewTarget: (target: HTMLDivElement | null) => void;
}
export function AssistantWindow({ target, conversation, reviewing, close, showGeneral, setReviewTarget }: Props): React.JSX.Element | null {
  const text = sellerAssistantCopy[conversation.locale];
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reviewing) panelRef.current?.focus();
  }, [reviewing, target]);
  useEffect(() => {
    if (reviewing) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopImmediatePropagation(); close();
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [reviewing, close]);
  return target && createPortal(<div ref={panelRef} tabIndex={-1} className="seller-assistant-window"
    role="region" aria-label={text.title} lang={conversation.locale}>
    <div className="assistant-window-header">
      <h3>{text.title}</h3>
      <button type="button" className="btn btn-secondary btn-sm" onClick={close} aria-label={text.close}>×</button>
    </div>
    <label>{text.language}
      <select name="assistant-language" value={conversation.locale}
        onChange={event => conversation.setLanguage(event.target.value === 'bn' ? 'bn' : 'en')}>
        <option value="en">English</option><option value="bn">বাংলা</option>
      </select>
    </label>
    <nav aria-label={text.title} className="assistant-context-controls">
      <button type="button" className="btn btn-secondary btn-sm" aria-pressed={!reviewing} onClick={showGeneral}>{text.general}</button>
      <button type="button" className="btn btn-secondary btn-sm" disabled={conversation.submission.locked}
        onClick={() => { conversation.newConversation(); showGeneral(); }}>{text.newChat}</button>
    </nav>
    <p className="assistant-context-label" role="status">{reviewing ? text.review : text.general}</p>
    <div ref={setReviewTarget} />
    {!reviewing && <AssistantConversation conversation={conversation} />}
  </div>, target);
}
