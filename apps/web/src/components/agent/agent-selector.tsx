import { Hammer, BarChart3 } from "lucide-react";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { AGENT_DEFINITIONS } from "@/lib/constants";
import {
  MOCK_BUILDER_CONVERSATION,
  MOCK_ANALYST_CONVERSATION,
} from "@/lib/mock-data";
import type { AgentType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TILE_CONFIG: Record<
  AgentType,
  { icon: typeof Hammer; bgSubtle: string; textColor: string; conversations: typeof MOCK_BUILDER_CONVERSATION }
> = {
  builder: {
    icon: Hammer,
    bgSubtle: "bg-cm-agent-builder-subtle",
    textColor: "text-cm-agent-builder",
    conversations: MOCK_BUILDER_CONVERSATION,
  },
  analyst: {
    icon: BarChart3,
    bgSubtle: "bg-cm-agent-analyst-subtle",
    textColor: "text-cm-agent-analyst",
    conversations: MOCK_ANALYST_CONVERSATION,
  },
};

export function AgentSelector() {
  const { projectId } = useActiveProject();
  const { setActiveAgent, loadConversation } = useAgentStore();

  function handleSelect(type: AgentType) {
    if (!projectId) return;
    setActiveAgent(projectId, type);
    loadConversation(projectId, TILE_CONFIG[type].conversations);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
      <div className="mb-2 text-center">
        <h2 className="text-sm font-semibold text-cm-text-primary">Choose an Agent</h2>
        <p className="mt-1 text-xs text-cm-text-secondary">Select an agent to start a conversation</p>
      </div>

      <div className="flex w-full flex-col gap-3">
        {AGENT_DEFINITIONS.map((agent) => {
          const config = TILE_CONFIG[agent.type];
          const Icon = config.icon;

          return (
            <button
              key={agent.type}
              type="button"
              onClick={() => handleSelect(agent.type)}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-cm-border-primary bg-white p-4 text-left shadow-sm",
                "transition-colors hover:bg-cm-bg-elevated"
              )}
            >
              <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", config.bgSubtle, config.textColor)}>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-cm-text-primary">{agent.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-cm-text-secondary">{agent.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
