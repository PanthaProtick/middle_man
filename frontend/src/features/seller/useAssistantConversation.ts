import { useState } from 'react';
import type { Locale } from '../locale/storage';
import { interpretWorkflow, isCreation, messageLocale, type AssistantDraft, type AssistantWorkflow } from './assistantConversation';
import { emptyOrderFields, hasMultipleOrderFields, orderMessage, orderSummary, type OrderFields } from './guidedOrder';
import { useGuidedOrderSubmission } from './useGuidedOrderSubmission';
import { fetchPaymentAccounts } from './api';
import type { PaymentAccount, SellerOrder } from './types';

export interface ConversationOptions {
  accounts?: PaymentAccount[]; token?: string;
  onOrderCreated?: (order: SellerOrder) => void;
  onOpenOrder?: (order: SellerOrder) => void;
}

type Message = { user: string } | { reply: 'clarify' | 'multiple' | AssistantWorkflow };
export function useAssistantConversation(initialLocale: Locale, options: ConversationOptions = {}) {
  const [locale, setLocale] = useState(initialLocale);
  const [manualLanguage, setManualLanguage] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [workflow, setWorkflow] = useState<AssistantWorkflow | null>(null);
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [pending, setPending] = useState<AssistantWorkflow | 'reset' | 'discard' | null>(null);
  const [completedOrder, setCompletedOrder] = useState<SellerOrder | null>(null);
  const [refreshedAccounts, setRefreshedAccounts] = useState<PaymentAccount[] | null>(null);
  const [accountStatus, setAccountStatus] = useState<'idle' | 'refreshing' | 'refreshFailed'>('idle');
  const accounts = refreshedAccounts ?? options.accounts ?? [];
  const submission = useGuidedOrderSubmission(options.token, order => {
    setCompletedOrder(order); setDraft(null); options.onOrderCreated?.(order);
  });
  const updateOrder = (patch: Partial<OrderFields & { value: string }>) => {
    if (submission.frozen) return;
    submission.reset();
    const { value, ...fields } = patch;
    setDraft(current => current?.workflow === 'order' ? { ...current,
      value: value ?? current.value, order: { ...emptyOrderFields(), ...current.order, ...fields } } : current);
  };
  const select = (next: AssistantWorkflow) => {
    if (submission.locked && isCreation(next)) return;
    if (isCreation(next)) {
      if (draft && draft.workflow !== next) { setPending(next); return; }
      if (!draft) { submission.reset(); setCompletedOrder(null); }
      setDraft(current => current ?? { workflow: next, value: '' });
    }
    setWorkflow(next);
  };
  const reset = () => { submission.reset(); setCompletedOrder(null); setMessages([]); setInput(''); setWorkflow(null); setDraft(null); setPending(null); };
  return {
    locale, messages, input, setInput, workflow, draft, pending, accounts, completedOrder, submission, token: options.token,
    openOrder: (order: SellerOrder) => options.onOpenOrder?.(order),
    updateOrder, orderSummary: orderSummary(draft?.value ?? '', draft?.order ?? emptyOrderFields(), accounts),
    accountStatus,
    refreshAccounts: async () => {
      if (accountStatus === 'refreshing') return;
      setAccountStatus('refreshing');
      try { setRefreshedAccounts(await fetchPaymentAccounts(options.token)); setAccountStatus('idle'); }
      catch { setAccountStatus('refreshFailed'); }
    },
    setLanguage: (next: Locale) => { setManualLanguage(true); setLocale(next); },
    select,
    send: (message: string) => {
      if (pending) return;
      if (!manualLanguage) setLocale(messageLocale(message, locale));
      const intents = interpretWorkflow(message);
      const multipleOrders = /\b(?:two|multiple|[2-9])\s+orders?\b|(?:দুই|দুটি|একাধিক|[২-৯])\s*(?:টি|টা)?\s*অর্ডার/i.test(message);
      const repeatedCreations = [...message.matchAll(/\b(?:create|make|add|new|notun)\b[^;.\n]{0,30}\border\b|(?:নতুন|তৈরি)\s*অর্ডার|অর্ডার\s*তৈরি/gi)].length > 1;
      if (multipleOrders || repeatedCreations || hasMultipleOrderFields(message) || intents.length > 1) {
        setMessages(current => [...current, { user: message }, { reply: 'multiple' }]); return;
      }
      if (draft?.workflow === 'order' && /\b(?:another|second|next|additional)\s+order\b|আরেক(?:টি|টা)?\s*অর্ডার|arek(?:ta|ti)?\s+order/i.test(message)) {
        setMessages(current => [...current, { user: message }, { reply: 'multiple' }]);
        if (!submission.locked) setPending('order');
        return;
      }
      setMessages(current => [...current, { user: message }, { reply: intents.length === 1 ? intents[0] : intents.length ? 'multiple' : 'clarify' }]);
      if (intents.length === 1) select(intents[0]);
      if ((draft?.workflow === 'order' && workflow === 'order' && !intents.length) ||
        (intents[0] === 'order' && (!draft || draft.workflow === 'order'))) {
        const patch = orderMessage(message, accounts);
        if (Object.keys(patch).length && !submission.frozen) {
          submission.reset();
          const { value, ...fields } = patch;
          setDraft(current => ({ workflow: 'order', value: value ?? current?.value ?? '',
            order: { ...emptyOrderFields(), ...current?.order, ...fields } }));
        }
      }
    },
    edit: (value: string) => { if (draft?.workflow === 'order') updateOrder({ value }); else setDraft(current => current ? { ...current, value } : null); },
    newConversation: () => { if (submission.locked) return; if (draft) setPending('reset'); else reset(); },
    requestDiscard: () => { if (draft && !submission.locked) setPending('discard'); },
    resume: () => { if (draft) setWorkflow(draft.workflow); setPending(null); },
    cancel: () => setPending(null),
    confirmDiscard: () => {
      if (submission.locked) return;
      submission.reset(); setCompletedOrder(null);
      const next = pending;
      setDraft(null); setPending(null);
      if (next === 'reset') reset();
      else if (next && next !== 'discard') {
        setWorkflow(next);
        if (isCreation(next)) setDraft({ workflow: next, value: '' });
      } else setWorkflow(null);
    },
  };
}
export type AssistantConversation = ReturnType<typeof useAssistantConversation>;
