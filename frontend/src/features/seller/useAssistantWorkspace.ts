import { createContext, useContext } from 'react';

export interface AssistantWorkspaceState {
  activeId: string | null;
  modalId: string | null;
  target: HTMLDivElement | null;
  open: (id: string, trigger: HTMLElement) => void;
  close: (returnFocus?: boolean) => void;
  setTarget: (target: HTMLDivElement | null) => void;
  followModal: (id: string | null) => void;
}
export const AssistantWorkspaceContext = createContext<AssistantWorkspaceState | null>(null);
export const useAssistantWorkspace = () => useContext(AssistantWorkspaceContext);

