import { create } from "zustand";

interface NodeContext {
  nodeId: string;
  label: string;
  sourceFileId?: string;
  filename?: string;
}

interface AgentState {
  isPanelOpen: boolean;
  nodeContext: NodeContext | null;
  togglePanel: () => void;
  openPanel: () => void;
  setNodeContext: (ctx: NodeContext | null) => void;
}

export const useAgentStore = create<AgentState>()((set) => ({
  isPanelOpen: true,
  nodeContext: null,

  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  openPanel: () => set({ isPanelOpen: true }),

  setNodeContext: (nodeContext) => set({ nodeContext }),
}));
