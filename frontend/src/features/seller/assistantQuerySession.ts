import type { AttentionState } from './useAttentionQuery';
import type { PreparationState } from './usePreparationQuery';

interface QuerySession<T> {
  read: (token?: string) => T | undefined;
  save: (token: string | undefined, state: T) => void;
}

/** Conversation-owned snapshots survive card unmounts and never cross authorization contexts. */
function querySession<T extends AttentionState | PreparationState>(): QuerySession<T> {
  let authorization: string | undefined;
  let snapshot: T | undefined;
  return {
    read: token => token === authorization ? snapshot : undefined,
    save: (token, state) => { authorization = token;
      snapshot = state.status === 'loading' && state.retrievedAt ? { ...state, status: 'ready' } : state; },
  };
}

export function createQuerySession() {
  return { attention: querySession<AttentionState>(), preparation: querySession<PreparationState>() };
}
export type AssistantQuerySession = ReturnType<typeof createQuerySession>;
