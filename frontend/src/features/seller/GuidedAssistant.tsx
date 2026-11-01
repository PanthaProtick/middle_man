import { sellerAssistantCopy } from '../locale/sellerAssistantCopy';
import { isCreation, workflows } from './assistantConversation';
import type { AssistantConversation as Conversation } from './useAssistantConversation';
import { AssistantDiscardPrompt } from './AssistantDiscardPrompt';
import { GuidedOrderFields } from './GuidedOrderFields';
import { GuidedOrderResult } from './GuidedOrderResult';
import { GuidedPaymentFields } from './GuidedPaymentFields';
import { GuidedPaymentResult } from './GuidedPaymentResult';
import { PreparationPreview } from './PreparationPreview';

export function AssistantConversation({ conversation }: { conversation: Conversation }): React.JSX.Element {
  const c = conversation;
  const text = sellerAssistantCopy[c.locale];
  const { input, setInput } = c;
  return <div className="assistant-conversation" lang={c.locale}>
    <p>{text.welcome}</p>
    <div role="log" aria-label={text.log} aria-live="polite" aria-relevant="additions">
      {c.messages.map((message, index) => <p key={index} className={'user' in message ? 'assistant-user-message' : 'assistant-reply'}>
        {'user' in message ? message.user : text[message.reply]}
      </p>)}
    </div>
    <div className="assistant-workflow-choices">
      {workflows.map(workflow => <button key={workflow} type="button" className="btn btn-secondary btn-sm"
        disabled={Boolean(c.pending) || (c.locked && isCreation(workflow))}
        onClick={() => c.select(workflow)}>{text[workflow]}</button>)}
    </div>
    {c.workflow && <section data-testid="assistant-workflow" aria-label={text[c.workflow]}>
      <h4>{text[c.workflow]}</h4>
      {c.completedPayment && c.workflow === 'payment'
        ? <GuidedPaymentResult result={c.completedPayment} locale={c.locale} token={c.token}
          onOpenOrder={c.openOrder} onOpenPayment={c.openPayment} />
      : c.completedOrder && c.workflow === 'order' ? <GuidedOrderResult order={c.completedOrder} locale={c.locale} token={c.token} onOpenOrder={c.openOrder} />
      : c.draft?.workflow === 'order' && c.workflow === 'order' ? <GuidedOrderFields conversation={c} />
      : c.draft?.workflow === 'payment' && c.workflow === 'payment' ? <GuidedPaymentFields conversation={c} />
      : c.workflow === 'preparation' ? <PreparationPreview
        locale={c.locale} state={c.preparation}
        onRefresh={c.preparation.refresh} onLoadMore={c.preparation.loadMore}
        onOpenOrder={c.openOrder} onShowInDashboard={c.showInDashboard} />
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
    <form onSubmit={event => {
      event.preventDefault();
      if (input.trim() && !c.pending) { c.send(input.trim()); setInput(''); }
    }}>
      <label>{text.message}<textarea name="assistant-message" value={input} maxLength={2000}
        disabled={Boolean(c.pending)} onChange={event => setInput(event.target.value)} /></label>
      <button type="submit" className="btn btn-primary" disabled={!input.trim() || Boolean(c.pending)}>{text.send}</button>
    </form>
  </div>;
}
