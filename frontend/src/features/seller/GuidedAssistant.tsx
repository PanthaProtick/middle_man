import { useCallback, useLayoutEffect, useRef } from 'react';
import { Send, Sparkles } from 'lucide-react';
import './AssistantChat.css';
import './AssistantPreview.css';
import './AssistantWorkflow.css';
import { sellerAssistantCopy } from '../locale/sellerAssistantCopy';
import { assistantScrollTarget } from './assistantScroll';
import { isCreation, workflows } from './assistantConversation';
import type { AssistantConversation as Conversation } from './useAssistantConversation';
import { AssistantDiscardPrompt } from './AssistantDiscardPrompt';
import { GuidedOrderFields } from './GuidedOrderFields';
import { GuidedOrderResult } from './GuidedOrderResult';
import { GuidedPaymentFields } from './GuidedPaymentFields';
import { GuidedPaymentResult } from './GuidedPaymentResult';
import { AssistantQueryCard } from './AssistantQueryCard';

export function AssistantConversation({ conversation, setReviewTarget }: {
  conversation: Conversation; setReviewTarget?: (target: HTMLDivElement | null) => void;
}): React.JSX.Element {
  const c = conversation;
  const text = sellerAssistantCopy[c.locale];
  const { input, setInput } = c;
  const feed = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const pinned = useRef(true);
  const renderedMessages = useRef(0);
  const processing = c.submission.state === 'processing' || c.paymentSubmission.state === 'processing';
  const scrollToLatest = useCallback(() => {
    const node = feed.current;
    if (!node) return;
    const newest = node.querySelector<HTMLElement>('[role="log"]')?.lastElementChild;
    if (!(newest instanceof HTMLElement)) { node.scrollTop = node.scrollHeight; return; }
    const feedRect = node.getBoundingClientRect();
    const newestRect = newest.getBoundingClientRect();
    const target = assistantScrollTarget({
      viewportHeight: node.clientHeight, scrollHeight: node.scrollHeight,
      newestTop: node.scrollTop + newestRect.top - feedRect.top, newestHeight: newestRect.height,
    });
    node.scrollTop = target;
    pinned.current = node.scrollHeight - target - node.clientHeight < 40;
  }, []);
  useLayoutEffect(() => {
    const node = feed.current;
    if (!node) return;
    const previous = renderedMessages.current;
    renderedMessages.current = c.messages.length;
    if (!c.messages.length) { node.scrollTop = 0; pinned.current = true; return; }
    const received = c.messages.slice(previous);
    if (received.length) {
      if (pinned.current || received.some(message => 'user' in message)) scrollToLatest();
      return;
    }
    if (pinned.current) scrollToLatest();
  }, [c.messages, c.workflow, c.pending, c.orderReviewing, c.paymentReviewing, c.submission.state,
    c.paymentSubmission.state, scrollToLatest]);
  useLayoutEffect(() => {
    if (!composer.current) return;
    composer.current.style.height = 'auto';
    composer.current.style.height = `${Math.min(composer.current.scrollHeight, 160)}px`;
  }, [input]);
  return <div className="assistant-conversation" lang={c.locale}>
    <div className="assistant-chat-feed" ref={feed} onScroll={() => {
      const node = feed.current;
      if (node) pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 40;
    }}>
      <div className="assistant-welcome-card">
        <span className="assistant-welcome-icon" aria-hidden="true">
          <Sparkles size={16} />
        </span>
        <p>{text.welcome}</p>
      </div>
      {setReviewTarget && <div ref={setReviewTarget} />}
      <div role="log" aria-label={text.log} aria-live="polite" aria-relevant="additions">
        {c.messages.map((message, index) => 'orderResult' in message
          ? <GuidedOrderResult key={index} order={message.orderResult} locale={c.locale} token={c.token} onOpenOrder={c.openOrder} />
          : 'paymentResult' in message
          ? <GuidedPaymentResult key={index} result={message.paymentResult} account={message.account} locale={c.locale}
            token={c.token} onOpenOrder={c.openOrder} onOpenPayment={c.openPayment} />
          : 'query' in message
          ? <AssistantQueryCard key={index} query={message.query} session={message.session} conversation={c} />
          : <p key={index} className={'user' in message ? 'assistant-user-message' : 'assistant-reply'}>
          {!('user' in message) && <span className="assistant-avatar" aria-hidden="true"><Sparkles size={13} /></span>}
          <span>{'user' in message ? message.user : text[message.reply]}</span>
          <time dateTime={message.at}>{new Date(message.at).toLocaleTimeString(c.locale, { hour: '2-digit', minute: '2-digit' })}</time>
        </p>)}
      </div>
      {c.workflow && isCreation(c.workflow) && <section className="assistant-workflow-card" data-testid="assistant-workflow" aria-label={text[c.workflow]}>
        <h4>{text[c.workflow]}</h4>
        {c.draft?.workflow === 'order' && c.workflow === 'order' ? <GuidedOrderFields conversation={c} />
        : c.draft?.workflow === 'payment' && c.workflow === 'payment' ? <GuidedPaymentFields conversation={c} />
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
      {processing && <div className="assistant-typing" role="status">
        <span className="assistant-avatar" aria-hidden="true"><Sparkles size={13} /></span>
        <span className="assistant-typing-bubble" aria-hidden="true">
          <span /><span /><span />
        </span>
        <span className="sr-only">{text.working}</span>
      </div>}
    </div>
    <div className="assistant-chat-composer">
      <div className="assistant-workflow-choices">
        {workflows.map(workflow => <button key={workflow} type="button" className="btn btn-secondary btn-sm assistant-workflow-chip"
          disabled={Boolean(c.pending) || (c.locked && isCreation(workflow))}
          onClick={() => c.select(workflow)}>{workflow === 'order' ? text.newOrder : text[workflow]}</button>)}
      </div>
      <form className="assistant-composer-form" onSubmit={event => {
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
        <button type="submit" className="btn btn-primary assistant-send-btn" disabled={!input.trim() || Boolean(c.pending)}>
          <Send size={15} aria-hidden="true" />
          <span>{text.send}</span>
        </button>
      </form>
    </div>
  </div>;
}
