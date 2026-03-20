import { useCallback } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { EditableLabel } from "@/components/shared/editable-label";
import { QualityCheckTab } from "./quality-check-tab";

interface QualityDetailPanelProps {
  nodeId: string;
}

export function QualityDetailPanel({ nodeId }: QualityDetailPanelProps) {
  const { projectId } = useActiveProject();
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined,
  );
  const selectNode = usePipelineStore((s) => s.selectNode);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const openPanel = useAgentStore((s) => s.openPanel);

  const handleViewChat = useCallback(() => {
    if (!projectId) return;
    selectNode(projectId, null);
    openPanel();
  }, [projectId, selectNode, openPanel]);

  if (!node || !projectId) return null;

  const pass = node.data.checksPass ?? 0;
  const warn = node.data.checksWarn ?? 0;
  const fail = node.data.checksFail ?? 0;
  const total = pass + warn + fail;

  return (
    <div className="flex w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-cm-border-primary px-4 py-3 shrink-0">
        <div className="min-w-0 flex-1">
          <EditableLabel
            value={node.data.label}
            onCommit={(v) => updateNodeData(projectId, nodeId, { label: v })}
            className="text-sm font-medium text-cm-text-primary"
          />
          <p className="text-xs text-cm-text-tertiary mt-0.5">
            {total > 0
              ? `${pass} passed · ${warn} warnings · ${fail} critical`
              : "No checks run yet"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleViewChat} title="Back to Chat">
            <MessageCircle className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => selectNode(projectId, null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <QualityCheckTab nodeId={nodeId} />
      </div>
    </div>
  );
}
