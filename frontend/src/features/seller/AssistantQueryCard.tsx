import { useEffect, useLayoutEffect } from 'react';
import { sellerAssistantCopy } from '../locale/sellerAssistantCopy';
import { AttentionPreview } from './AttentionPreview';
import { PreparationPreview } from './PreparationPreview';
import { useAttentionQuery } from './useAttentionQuery';
import { usePreparationQuery } from './usePreparationQuery';
import type { AssistantConversation } from './useAssistantConversation';
import type { AssistantQuerySession } from './assistantQuerySession';
import type { WorkQuery } from './types';

type Props = { query: WorkQuery; conversation: AssistantConversation; session: AssistantQuerySession };

/** Each timeline query owns its request, pagination, and authorization context. */
export function AssistantQueryCard({ query, conversation, session }: Props): React.JSX.Element {
  return <section className="assistant-query-card" data-testid="assistant-query"
    aria-label={sellerAssistantCopy[conversation.locale][query]}>
    <h4>{sellerAssistantCopy[conversation.locale][query]}</h4>
    {query === 'attention' ? <AttentionCard conversation={conversation} session={session} /> : <PreparationCard conversation={conversation} session={session} />}
  </section>;
}

function AttentionCard({ conversation: c, session }: Pick<Props, 'conversation' | 'session'>): React.JSX.Element {
  const state = useAttentionQuery(c.token, session.attention.read(c.token));
  const { refresh } = state;
  useEffect(() => {
    const saved = session.attention.read(c.token);
    if (!saved || saved.status === 'idle' || saved.status === 'loading') void refresh();
  }, [c.token, session, refresh]);
  useLayoutEffect(() => { session.attention.save(c.token, state); }, [c.token, session, state]);
  return <AttentionPreview locale={c.locale} state={state} onRefresh={state.refresh} onLoadMore={state.loadMore}
    onOpenOrder={c.openOrder} onShowInDashboard={() => c.showInDashboard('attention')} />;
}

function PreparationCard({ conversation: c, session }: Pick<Props, 'conversation' | 'session'>): React.JSX.Element {
  const state = usePreparationQuery(c.token, session.preparation.read(c.token));
  const { refresh } = state;
  useEffect(() => {
    const saved = session.preparation.read(c.token);
    if (!saved || saved.status === 'idle' || saved.status === 'loading') void refresh();
  }, [c.token, session, refresh]);
  useLayoutEffect(() => { session.preparation.save(c.token, state); }, [c.token, session, state]);
  return <PreparationPreview locale={c.locale} state={state} onRefresh={state.refresh} onLoadMore={state.loadMore}
    onOpenOrder={c.openOrder} onShowInDashboard={() => c.showInDashboard('preparation')} />;
}
