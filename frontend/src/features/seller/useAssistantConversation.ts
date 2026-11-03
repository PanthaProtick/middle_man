import { useState } from 'react';
import { createQuerySession, type AssistantQuerySession } from './assistantQuerySession';
import type { Locale } from '../locale/storage';
import { interpretWorkflow, isCreation, messageLocale, type AssistantDraft, type AssistantWorkflow } from './assistantConversation';
import { emptyOrderFields, hasMultipleOrderFields, orderMessage, orderSummary, type OrderFields } from './guidedOrder';
import {
  emptyPaymentFields, hasMultiplePaymentFields, paymentMessage, paymentSummary, type PaymentFields,
} from './guidedPayment';
import { useGuidedOrderSubmission } from './useGuidedOrderSubmission';
import { useGuidedPaymentSubmission } from './useGuidedPaymentSubmission';
import { fetchPaymentAccounts } from './api';
import type { PaymentAccount, RecordedTransactionResult, SellerOrder, WorkQuery } from './types';

export interface ConversationOptions {
  accounts?: PaymentAccount[]; token?: string;
  onOrderCreated?: (order: SellerOrder) => void;
  onOpenOrder?: (order: SellerOrder) => void;
  onPaymentRecorded?: (result: RecordedTransactionResult) => void;
  onOpenPayment?: (receiptId: string) => void;
  onShowInDashboard?: (query: WorkQuery) => void;
  onConversationReset?: () => void;
}

type Message = ({ user: string } | { reply: 'clarify' | 'multiple' | AssistantWorkflow } |
  { query: WorkQuery; session: AssistantQuerySession } | { orderResult: SellerOrder } | { paymentResult: RecordedTransactionResult; account: string }) & { at: string };
export function useAssistantConversation(initialLocale: Locale, options: ConversationOptions = {}) {
  const [locale, setLocale] = useState(initialLocale);
  const [manualLanguage, setManualLanguage] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [authorization, setAuthorization] = useState(options.token);
  if (authorization !== options.token) {
    setAuthorization(options.token);
    setMessages(current => current.map(message => 'query' in message ? { ...message, session: createQuerySession() } : message));
  }
  const [input, setInput] = useState('');
  const [workflow, setWorkflow] = useState<AssistantWorkflow | null>(null);
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [orderReviewing, setOrderReviewing] = useState(false);
  const [paymentReviewing, setPaymentReviewing] = useState(false);
  const [pending, setPending] = useState<AssistantWorkflow | 'reset' | 'discard' | null>(null);
  const [pendingDraft, setPendingDraft] = useState<AssistantDraft | null>(null);
  const [refreshedAccounts, setRefreshedAccounts] = useState<PaymentAccount[] | null>(null);
  const [accountStatus, setAccountStatus] = useState<'idle' | 'refreshing' | 'refreshFailed'>('idle');
  const accounts = refreshedAccounts ?? options.accounts ?? [];
  const orderSubmission = useGuidedOrderSubmission(options.token, order => {
    setMessages(current => [...current, { orderResult: order, at: new Date().toISOString() }]);
    setDraft(null); setOrderReviewing(false);
    setWorkflow(current => current === 'order' ? null : current);
    options.onOrderCreated?.(order);
  });
  const paymentSubmission = useGuidedPaymentSubmission(options.token, result => {
    const account = accounts.find(item => item.id === result.receipt.payment_account_id);
    setMessages(current => [...current, { paymentResult: result,
      account: account ? `${account.label} · ${account.provider.toUpperCase()} · ${account.receiving_number}` : result.receipt.payment_account_id,
      at: new Date().toISOString() }]);
    setDraft(null); setPaymentReviewing(false);
    setWorkflow(current => current === 'payment' ? null : current);
    options.onPaymentRecorded?.(result);
  });
  const locked = orderSubmission.locked || paymentSubmission.locked;
  const frozen = orderSubmission.frozen || paymentSubmission.frozen;
  const updateOrder = (patch: Partial<OrderFields & { value: string }>) => {
    if (frozen) return;
    setOrderReviewing(false);
    orderSubmission.reset();
    const { value, ...fields } = patch;
    setDraft(current => current?.workflow === 'order' ? { ...current,
      value: value ?? current.value, order: { ...emptyOrderFields(), ...current.order, ...fields } } : current);
  };
  const updatePayment = (patch: Partial<PaymentFields>) => {
    if (frozen) return;
    setPaymentReviewing(false);
    paymentSubmission.reset();
    setDraft(current => current?.workflow === 'payment' ? { ...current,
      payment: { ...emptyPaymentFields(), ...current.payment, ...patch } } : current);
  };
  const select = (next: AssistantWorkflow) => {
    if (locked && isCreation(next)) return;
    if (isCreation(next)) {
      if (draft) { setPendingDraft(null); setPending(next); return; }
      if (!draft) {
        setOrderReviewing(false);
        orderSubmission.reset(); paymentSubmission.reset();
        setPaymentReviewing(false);
      }
      setDraft(current => current ?? {
        workflow: next, value: '', ...(next === 'payment' ? { payment: emptyPaymentFields() } : {}),
      });
    }
    setWorkflow(next);
    if (!isCreation(next)) setMessages(current => [...current, { query: next, session: createQuerySession(), at: new Date().toISOString() }]);
  };
  const reset = () => {
    setOrderReviewing(false);
    orderSubmission.reset(); paymentSubmission.reset();
    setPaymentReviewing(false);
    setMessages([]); setInput(''); setWorkflow(null); setDraft(null); setPending(null); setPendingDraft(null);
    options.onConversationReset?.();
  };
  return {
    locale, messages, input, setInput, workflow, draft, pending, accounts,
    submission: orderSubmission, paymentSubmission, locked, frozen, token: options.token,
    openOrder: (order: SellerOrder) => options.onOpenOrder?.(order),
    openPayment: (receiptId: string) => options.onOpenPayment?.(receiptId),
    showInDashboard: (query: WorkQuery) => options.onShowInDashboard?.(query),
    updateOrder, updatePayment,
    orderReviewing,
    paymentReviewing,
    reviewPayment: () => {
      if (!frozen && !pending && paymentSummary(draft?.payment ?? emptyPaymentFields(), accounts).payload) setPaymentReviewing(true);
    },
    changePayment: () => { if (!frozen && !pending) { paymentSubmission.reset(); setPaymentReviewing(false); } },
    reviewOrder: () => {
      if (!frozen && !pending && orderSummary(draft?.value ?? '', draft?.order ?? emptyOrderFields(), accounts).payload) setOrderReviewing(true);
    },
    changeOrder: () => { if (!frozen && !pending) { orderSubmission.reset(); setOrderReviewing(false); } },
    orderSummary: orderSummary(draft?.value ?? '', draft?.order ?? emptyOrderFields(), accounts),
    paymentSummary: paymentSummary(draft?.payment ?? emptyPaymentFields(), accounts),
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
      if (pending || !message.trim()) return;
      const at = new Date().toISOString();
      if (!manualLanguage) setLocale(messageLocale(message, locale));
      const intents = interpretWorkflow(message);
      const multipleOrders = /\b(?:two|multiple|[2-9])\s+orders?\b|(?:দুই|দুটি|একাধিক|[২-৯])\s*(?:টি|টা)?\s*অর্ডার/i.test(message);
      const multiplePayments = /\b(?:two|multiple|[2-9])\s+(?:payments?|transactions?)\b|(?:দুই|দুটি|একাধিক|[২-৯])\s*(?:টি|টা)?\s*(?:পেমেন্ট|লেনদেন)/i.test(message);
      const repeatedCreations = [...message.matchAll(/\b(?:create|make|add|new|notun)\b[^;.\n]{0,30}\border\b|(?:নতুন|তৈরি)\s*অর্ডার|অর্ডার\s*তৈরি/gi)].length > 1;
      const repeatedPayments = [...message.matchAll(/\b(?:record|add|log|received)\b[^;.\n]{0,30}\b(?:payment|transaction)\b|(?:পেমেন্ট|লেনদেন)\s*(?:রেকর্ড|যোগ)/gi)].length > 1;
      if (multipleOrders || multiplePayments || repeatedCreations || repeatedPayments ||
        hasMultipleOrderFields(message) || hasMultiplePaymentFields(message) || intents.length > 1) {
        setMessages(current => [...current, { user: message, at }, { reply: 'multiple', at }]); return;
      }
      const explicitNew = message.match(/\b(?:new|another|second|next|additional|notun)\s+(?:order|payment|transaction)\b|(?:নতুন|আরেক(?:টি|টা)?)\s*(?:অর্ডার|পেমেন্ট|লেনদেন)|arek(?:ta|ti)?\s+(?:order|payment)/i);
      const newWorkflow = explicitNew ? /order|অর্ডার/i.test(explicitNew[0]) ? 'order' : 'payment' : undefined;
      const replacement = newWorkflow ?? (intents[0] !== draft?.workflow ? intents[0] : undefined);
      if (draft && replacement && isCreation(replacement)) {
        setMessages(current => [...current, { user: message, at }, { reply: replacement, at }]);
        if (!locked) {
          const { value = '', ...order } = orderMessage(message, accounts);
          setPendingDraft(replacement === 'order' ? { workflow: 'order', value, order: { ...emptyOrderFields(), ...order } }
            : { workflow: 'payment', value: '', payment: { ...emptyPaymentFields(), ...paymentMessage(message, accounts) } });
          setPending(replacement);
        }
        return;
      }
      setMessages(current => [...current, { user: message, at }, { at, reply: intents.length === 1 ? intents[0] : intents.length ? 'multiple' : 'clarify' }]);
      if (intents.length === 1) {
        if (intents[0] === draft?.workflow) setWorkflow(intents[0]);
        else select(intents[0]);
      }
      if ((draft?.workflow === 'order' && workflow === 'order' && !intents.length) ||
        (intents[0] === 'order' && (!draft || draft.workflow === 'order'))) {
        const patch = orderMessage(message, accounts);
        if (Object.keys(patch).length && !frozen) {
          setOrderReviewing(false);
          orderSubmission.reset();
          const { value, ...fields } = patch;
          setDraft(current => ({ workflow: 'order', value: value ?? current?.value ?? '',
            order: { ...emptyOrderFields(), ...current?.order, ...fields } }));
        }
      }
      if ((draft?.workflow === 'payment' && workflow === 'payment' && !intents.length) ||
        (intents[0] === 'payment' && (!draft || draft.workflow === 'payment'))) {
        const patch = paymentMessage(message, accounts);
        if (Object.keys(patch).length && !paymentSubmission.frozen) {
          setPaymentReviewing(false);
          paymentSubmission.reset();
          setDraft(current => ({ workflow: 'payment', value: current?.value ?? '',
            payment: { ...emptyPaymentFields(), ...current?.payment, ...patch } }));
        }
      }
    },
    edit: (value: string) => { if (draft?.workflow === 'order') updateOrder({ value }); },
    newConversation: () => { if (locked) return; if (draft) setPending('reset'); else reset(); },
    requestDiscard: () => { if (draft && !locked) setPending('discard'); },
    resume: () => { if (draft) setWorkflow(draft.workflow); setPending(null); setPendingDraft(null); },
    cancel: () => { setPending(null); setPendingDraft(null); },
    confirmDiscard: () => {
      if (locked) return;
      setOrderReviewing(false);
      orderSubmission.reset(); paymentSubmission.reset();
      setPaymentReviewing(false);
      const next = pending;
      setDraft(null); setPending(null); setPendingDraft(null);
      if (next === 'reset') reset();
      else if (next && next !== 'discard') {
        setWorkflow(next);
        if (isCreation(next)) setDraft(pendingDraft ?? { workflow: next, value: '',
          ...(next === 'payment' ? { payment: emptyPaymentFields() } : {}) });
      } else setWorkflow(null);
    },
  };
}
export type AssistantConversation = ReturnType<typeof useAssistantConversation>;
