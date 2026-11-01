import type { Locale } from '../locale/storage';

export type AssistantWorkflow = 'order' | 'payment' | 'attention' | 'preparation';
export type CreationWorkflow = Extract<AssistantWorkflow, 'order' | 'payment'>;
export interface AssistantDraft { workflow: CreationWorkflow; value: string }
export const workflows: AssistantWorkflow[] = ['order', 'payment', 'attention', 'preparation'];
export const isCreation = (workflow: AssistantWorkflow): workflow is CreationWorkflow =>
  workflow === 'order' || workflow === 'payment';

/** Intents only: arbitrary messages never leave this tab or become executable actions. */
export function interpretWorkflow(message: string): AssistantWorkflow[] {
  const text = message.normalize('NFKC').toLowerCase();
  if (/\b(cancel|delete|refund|reject|book)\b|বাতিল|মুছে|ফেরত/.test(text)) return [];
  const matches: AssistantWorkflow[] = [];
  if (/(?:create|new|make|add|notun).{0,25}order|order.{0,25}(?:create|ban|kor|toiri|তৈরি)|(?:নতুন|তৈরি).{0,20}অর্ডার|অর্ডার.{0,20}(?:তৈরি|কর)/.test(text)) matches.push('order');
  if (/(?:record|add|received|log).{0,25}(?:payment|transaction)|(?:payment|transaction|পেমেন্ট|লেনদেন).{0,25}(?:record|entry|লিখ|রেকর্ড|যোগ|kor|peyechi)|(?:টাকা|taka).{0,15}(?:পেয়েছি|পেয়েছি|জমা|peyechi)/.test(text)) matches.push('payment');
  if (/attention|নজর|মনোযোগ|সমস্যা|করণীয়|করণীয়|কাজ বাকি|kaj baki/.test(text)) matches.push('attention');
  if (/(?:delivery|ডেলিভারি|ডেলিভারির|কুরিয়ার).{0,30}(?:prepar|stag|প্রস্তুতি|বাকি|baki)|(?:awaiting|pending).{0,20}delivery|প্রস্তুতি.{0,15}বাকি/.test(text)) matches.push('preparation');
  return matches;
}

export function messageLocale(message: string, fallback: Locale): Locale {
  return /[\u0980-\u09ff]|\b(chai|korte|korbo|dorkar|banate|baki)\b/i.test(message) ? 'bn' : /[a-z]/i.test(message) ? 'en' : fallback;
}
