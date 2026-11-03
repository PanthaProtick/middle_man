import { useLayoutEffect, useRef } from 'react';
import './AssistantChat.css';
import { sellerAssistantCopy } from '../locale/sellerAssistantCopy';
import { isCreation, workflows } from './assistantConversation';
import type { AssistantConversation as Conversation } from './useAssistantConversation';
import { AssistantDiscardPrompt } from './AssistantDiscardPrompt';
import { GuidedOrderFields } from './GuidedOrderFields';
import { GuidedOrderResult } from './GuidedOrderResult';
import { GuidedPaymentFields } from './GuidedPaymentFields';
import { GuidedPaymentResult } from './GuidedPaymentResult';
import { PreparationPreview } from './PreparationPreview';
import { AttentionPreview } from './AttentionPreview';

export function AssistantConversation({ conversation }: { conversation: Conversation }): React.JSX.Element {
  const c = conversation;
  const text = sellerAssistantCopy[c.locale];
  const { input, setInput } = c;
  const feed = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
  }, [c.messages, c.workflow, c.pending]);
  useLayoutEffect(() => {
    if (!composer.current) return;
    composer.current.style.height = 'auto';
    composer.current.style.height = `${Math.min(composer.current.scrollHeight, 160)}px`;
  }, [input]);
  return <div className="assistant-conversation" lang={c.locale}>
    <div className="assistant-chat-feed" ref={feed}>
    <p>{text.welcome}</p>
    <div role="log" aria-label={text.log} aria-live="polite" aria-relevant="additions">
      {c.messages.map((message, index) => <p key={index} className={'user' in message ? 'assistant-user-message' : 'assistant-reply'}>
        {!('user' in message) && <span className="assistant-avatar" aria-hidden="true">M</span>}
        <span>{'user' in message ? message.user : text[message.reply]}</span>
        <time dateTime={message.at}>{new Date(message.at).toLocaleTimeString(c.locale, { hour: '2-digit', minute: '2-digit' })}</time>
      </p>)}
    </div>
    {c.workflow && <section data-testid="assistant-workflow" aria-label={text[c.workflow]}>
      <h4>{text[c.workflow]}</h4>
      {c.completedPayment && c.workflow === 'payment'
        ? <GuidedPaymentResult result={c.completedPayment} locale={c.locale} token={c.token}
          onOpenOrder={c.openOrder} onOpenPayment={c.openPayment} />
      : c.completedOrder && c.workflow === 'order' ? <GuidedOrderResult order={c.completedOrder} locale={c.locale} token={c.token} onOpenOrder={c.openOrder} />
      : c.draft?.workflow === 'order' && c.workflow === 'order' ? <GuidedOrderFields conversation={c} />
      : c.draft?.workflow === 'payment' && c.workflow === 'payment' ? <GuidedPaymentFields conversation={c} />
      : c.workflow === 'attention' ? <AttentionPreview
        locale={c.locale} state={c.attention}
        onRefresh={c.attention.refresh} onLoadMore={c.attention.loadMore}
        onOpenOrder={c.openOrder} onShowInDashboard={() => c.showInDashboard('attention')} />
      : c.workflow === 'preparation' ? <PreparationPreview
        locale={c.locale} state={c.preparation}
        onRefresh={c.preparation.refresh} onLoadMore={c.preparation.loadMore}
        onOpenOrder={c.openOrder} onShowInDashboard={() => c.showInDashboard('preparation')} />
      : c.draft?.workflow === c.workflow ? <>
        <p>{text.draftHelp}</p>
        <label>{c.workflow === 'order' ? text.orderField : text.paymentField}
          <input name="assistant-draft" value={c.draft.value} maxLength={500} disabled={Boolean(c.pending)}
            onChange={event => c.edit(event.target.value)} autoComplete="off" />
        </label>
      </> : <p role="status">{text.queryHelp}</p>}
    </section>}
    {c.draft && <div className="assistant-draft-status">
      <p>{text.draft}: {text[c.draft.workflow]}</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={c.resume} disabled={Boolean(c.pending)}>{text.resume}</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={c.requestDiscard} disabled={Boolean(c.pending) || c.locked}>{text.discard}</button>
    </div>}
    {c.pending && <AssistantDiscardPrompt conversation={c} />}
    </div>
    <div className="assistant-chat-composer">
    <div className="assistant-workflow-choices">
      {workflows.map(workflow => <button key={workflow} type="button" className="btn btn-secondary btn-sm"
        disabled={Boolean(c.pending) || (c.locked && isCreation(workflow))}
        onClick={() => c.select(workflow)}>{workflow === 'order' ? text.newOrder : text[workflow]}</button>)}
    </div>
    <form onSubmit={event => {
      event.preventDefault();
      if (input.trim() && !c.pending) { c.send(input.trim()); setInput(''); }
    }}>
      <label>{text.message}<textarea ref={composer} rows={1} name="assistant-message" value={input} maxLength={2000}
        disabled={Boolean(c.pending)} onChange={event => setInput(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault(); event.currentTarget.form?.requestSubmit();
          }
        }} /></label>
      <button type="submit" className="btn btn-primary" disabled={!input.trim() || Boolean(c.pending)}>{text.send}</button>
    </form>
    </div>
  </div>;
}
