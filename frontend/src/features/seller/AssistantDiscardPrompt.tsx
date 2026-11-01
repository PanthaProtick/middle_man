import { useEffect, useRef } from 'react';
import { sellerAssistantCopy } from '../locale/sellerAssistantCopy';
import type { AssistantConversation } from './useAssistantConversation';

export function AssistantDiscardPrompt({ conversation: c }: { conversation: AssistantConversation }): React.JSX.Element {
  const text = sellerAssistantCopy[c.locale];
  const resume = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    resume.current?.focus();
    return () => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);
  return <section role="alertdialog" aria-modal="false" aria-label={text.confirm}>
    <h4>{text.confirm}</h4><p>{text.confirmHelp}</p>
    <button ref={resume} type="button" className="btn btn-secondary" onClick={c.resume}>{text.resume}</button>
    <button type="button" className="btn btn-danger" onClick={c.confirmDiscard}>{text.discard}</button>
    <button type="button" className="btn btn-secondary" onClick={c.cancel}>{text.cancel}</button>
  </section>;
}
