import { createContext, useContext } from 'react';
import type { Locale } from '../locale/storage';

export interface AssistantWorkspaceState {
  activeId: string | null;
  modalId: string | null;
  target: HTMLDivElement | null;
  open: (id: string, trigger: HTMLElement) => void;
  close: (returnFocus?: boolean) => void;
  setTarget: (target: HTMLDivElement | null) => void;
  followModal: (id: string | null) => void;
  setEligible: (ids: string[]) => void;
  floating: boolean;
  showGeneral: () => void;
  isOpen: boolean;
  conversationLocale?: Locale;
}
export const AssistantWorkspaceContext = createContext<AssistantWorkspaceState | null>(null);
export const useAssistantWorkspace = () => useContext(AssistantWorkspaceContext);

