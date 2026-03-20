import { create } from "zustand";

interface NodeContext {
  nodeId: string;
  label: string;
}

interface AgentState {
  isPanelOpen: boolean;
  nodeContext: NodeContext | null;
  togglePanel: () => void;
  setNodeContext: (ctx: NodeContext | null) => void;
}

export const useAgentStore = create<AgentState>()((set) => ({
  isPanelOpen: true,
  nodeContext: null,

  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),

  setNodeContext: (nodeContext) => set({ nodeContext }),
}));
