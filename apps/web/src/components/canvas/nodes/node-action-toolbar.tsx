import { useCallback } from "react";
import { NodeToolbar, Position } from "@xyflow/react";
import { useParams } from "react-router-dom";
import {
  Trash2,
  MessageCircle,
  Copy,
  Eye,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore } from "@/lib/stores/agent-store";
import type { NodeCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NodeActionToolbarProps {
  nodeId: string;
  label: string;
  category: NodeCategory;
  sourceFileId?: string;
  status?: string;
  isVisible?: boolean;
}

interface ToolbarAction {
  icon: typeof Trash2;
  tooltip: string;
  onClick: () => void;
  destructive?: boolean;
  hidden?: boolean;
}

export function NodeActionToolbar({
  nodeId,
  label,
  category,
  sourceFileId,
  status,
  isVisible = false,
}: NodeActionToolbarProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const removeNode = usePipelineStore((s) => s.removeNode);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const setNodeContext = useAgentStore((s) => s.setNodeContext);
  const openPanel = useAgentStore((s) => s.openPanel);
  const setPendingMessage = useAgentStore((s) => s.setPendingMessage);

  const handleDelete = useCallback(() => {
    if (!projectId) return;
    removeNode(projectId, nodeId);
    toast.success("Node removed");
  }, [projectId, nodeId, removeNode]);

  const handleSendToChat = useCallback(() => {
    if (!projectId) return;
    selectNode(projectId, null);
    setNodeContext({ nodeId, label, sourceFileId });
    openPanel();
  }, [projectId, nodeId, label, sourceFileId, selectNode, setNodeContext, openPanel]);

  const handleInspect = useCallback(() => {
    if (!projectId) return;
    selectNode(projectId, nodeId);
  }, [projectId, nodeId, selectNode]);

  const handleDuplicate = useCallback(() => {
    toast.info("Duplicate coming soon");
  }, []);

  const handleRun = useCallback(() => {
    if (!projectId) return;
    selectNode(projectId, null);
    setPendingMessage({
      text: getRunPrompt(category),
      mentions: [{
        label,
        id: nodeId,
        sourceFileId,
        category,
      }],
    });
    openPanel();
  }, [projectId, category, label, nodeId, sourceFileId, selectNode, setPendingMessage, openPanel]);

  const isRunnable = status === "ready" || status === "idle" || status === "warning";

  const actions: ToolbarAction[] = [
    {
      icon: Eye,
      tooltip: "Inspect",
      onClick: handleInspect,
    },
    {
      icon: MessageCircle,
      tooltip: "Chat",
      onClick: handleSendToChat,
    },
    {
      icon: Play,
      tooltip: getRunLabel(category),
      onClick: handleRun,
      hidden: category === "sink" || !isRunnable,
    },
    {
      icon: Copy,
      tooltip: "Duplicate",
      onClick: handleDuplicate,
    },
    {
      icon: Trash2,
      tooltip: "Delete",
      onClick: handleDelete,
      destructive: true,
    },
  ];

  const visibleActions = actions.filter((a) => !a.hidden);

  return (
    <NodeToolbar
      isVisible={isVisible}
      position={Position.Top}
      align="end"
      offset={10}
      className="!p-0 !border-0 !bg-transparent !shadow-none"
    >
      <div
        className={cn(
          "flex items-center gap-px rounded-lg border border-black/[0.06] px-1 py-0.5",
          "bg-white/90 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.08)]",
          "transition-all duration-150 ease-out",
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-1 pointer-events-none",
        )}
      >
        {visibleActions.map((action, idx) => (
          <span key={action.tooltip} className="flex items-center">
            {action.destructive && idx > 0 && (
              <span className="mx-0.5 h-3.5 w-px bg-black/[0.06]" />
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-100",
                      action.destructive
                        ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                        : "text-slate-400 hover:text-slate-700 hover:bg-slate-100",
                    )}
                  />
                }
              >
                <action.icon className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {action.tooltip}
              </TooltipContent>
            </Tooltip>
          </span>
        ))}
      </div>
    </NodeToolbar>
  );
}

function getRunLabel(category: NodeCategory): string {
  switch (category) {
    case "source": return "Analyze";
    case "transform": return "Map Fields";
    case "harmonize": return "Harmonize";
    case "quality": return "Run Check";
    default: return "Run";
  }
}

function getRunPrompt(category: NodeCategory): string {
  switch (category) {
    case "source": return "Profile and analyze this source data";
    case "transform": return "Propose a target schema for the connected sources";
    case "harmonize": return "Run harmonization on accepted mappings";
    case "quality": return "Run a quality check on the harmonized data";
    default: return "Process this node";
  }
}
