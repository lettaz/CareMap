import { create } from "zustand";
import type { AgentMessage } from "@/lib/types";
import { MOCK_CONVERSATION } from "@/lib/mock-data";

export interface AgentSessionData {
  messages: AgentMessage[];
}

const SEEDED_SESSION: AgentSessionData = {
  messages: MOCK_CONVERSATION,
};

const EMPTY_SESSION: AgentSessionData = {
  messages: [],
};

interface AgentState {
  sessions: Record<string, AgentSessionData>;
  isPanelOpen: boolean;
  ensureSession: (projectId: string) => void;
  addMessage: (projectId: string, msg: AgentMessage) => void;
  setMessages: (projectId: string, msgs: AgentMessage[]) => void;
  clearMessages: (projectId: string) => void;
  togglePanel: () => void;
}

function getSession(state: AgentState, projectId: string): AgentSessionData {
  return state.sessions[projectId] ?? EMPTY_SESSION;
}

export const useAgentStore = create<AgentState>()((set) => ({
  sessions: {},
  isPanelOpen: true,

  ensureSession: (projectId) =>
    set((state) => {
      if (state.sessions[projectId]) return state;
      return { sessions: { ...state.sessions, [projectId]: { messages: [...SEEDED_SESSION.messages] } } };
    }),

  addMessage: (projectId, msg) =>
    set((state) => {
      const s = getSession(state, projectId);
      return { sessions: { ...state.sessions, [projectId]: { ...s, messages: [...s.messages, msg] } } };
    }),

  setMessages: (projectId, msgs) =>
    set((state) => ({
      sessions: { ...state.sessions, [projectId]: { ...getSession(state, projectId), messages: msgs } },
    })),

  clearMessages: (projectId) =>
    set((state) => ({
      sessions: { ...state.sessions, [projectId]: { ...EMPTY_SESSION } },
    })),

  togglePanel: () =>
    set((state) => ({ isPanelOpen: !state.isPanelOpen })),
}));
