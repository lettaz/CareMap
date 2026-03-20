import { create } from "zustand";
import type { NodeCategory } from "@/lib/types";

interface NodeContext {
  nodeId: string;
  label: string;
  sourceFileId?: string;
  filename?: string;
}

export interface PendingMention {
  label: string;
  id: string;
  sourceFileId?: string;
  category: NodeCategory;
}

export interface PendingMessage {
  text: string;
  mentions: PendingMention[];
  transformNodeId?: string;
}

interface AgentState {
  isPanelOpen: boolean;
  nodeContext: NodeContext | null;
  pendingMessage: PendingMessage | null;
  togglePanel: () => void;
  openPanel: () => void;
  setNodeContext: (ctx: NodeContext | null) => void;
  setPendingMessage: (msg: PendingMessage | null) => void;
}

export const useAgentStore = create<AgentState>()((set) => ({
  isPanelOpen: true,
  nodeContext: null,
  pendingMessage: null,

  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  openPanel: () => set({ isPanelOpen: true }),

  setNodeContext: (nodeContext) => set({ nodeContext }),
  setPendingMessage: (pendingMessage) => set({ pendingMessage }),
}));
