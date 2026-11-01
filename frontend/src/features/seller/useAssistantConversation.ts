import { useState } from 'react';
import type { Locale } from '../locale/storage';
import { interpretWorkflow, isCreation, messageLocale, type AssistantDraft, type AssistantWorkflow } from './assistantConversation';

type Message = { user: string } | { reply: 'clarify' | 'multiple' | AssistantWorkflow };
export function useAssistantConversation(initialLocale: Locale) {
  const [locale, setLocale] = useState(initialLocale);
  const [manualLanguage, setManualLanguage] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [workflow, setWorkflow] = useState<AssistantWorkflow | null>(null);
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [pending, setPending] = useState<AssistantWorkflow | 'reset' | 'discard' | null>(null);
  const select = (next: AssistantWorkflow) => {
    if (isCreation(next)) {
      if (draft && draft.workflow !== next) { setPending(next); return; }
      setDraft(current => current ?? { workflow: next, value: '' });
    }
    setWorkflow(next);
  };
  const reset = () => { setMessages([]); setInput(''); setWorkflow(null); setDraft(null); setPending(null); };
  return {
    locale, messages, input, setInput, workflow, draft, pending,
    setLanguage: (next: Locale) => { setManualLanguage(true); setLocale(next); },
    select,
    send: (message: string) => {
      if (pending) return;
      if (!manualLanguage) setLocale(messageLocale(message, locale));
      const intents = interpretWorkflow(message);
      setMessages(current => [...current, { user: message }, { reply: intents.length === 1 ? intents[0] : intents.length ? 'multiple' : 'clarify' }]);
      if (intents.length === 1) select(intents[0]);
    },
    edit: (value: string) => setDraft(current => current ? { ...current, value } : null),
    newConversation: () => { if (draft) setPending('reset'); else reset(); },
    requestDiscard: () => { if (draft) setPending('discard'); },
    resume: () => { if (draft) setWorkflow(draft.workflow); setPending(null); },
    cancel: () => setPending(null),
    confirmDiscard: () => {
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
