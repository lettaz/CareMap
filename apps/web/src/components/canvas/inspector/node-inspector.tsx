import { useCallback } from "react";
import { X, MessageCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { EditableLabel } from "@/components/shared/editable-label";
import { MappingsTab } from "./mappings-tab";
import { ConfirmedTab } from "./confirmed-tab";
import { StoreStatusTab } from "./store-status-tab";

interface NodeInspectorProps {
  nodeId: string;
}

export function NodeInspector({ nodeId }: NodeInspectorProps) {
  const { projectId } = useActiveProject();
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined
  );
  const selectNode = usePipelineStore((s) => s.selectNode);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const handleRename = useCallback(
    (newName: string) => {
      if (!projectId) return;
      updateNodeData(projectId, nodeId, { label: newName });
    },
    [projectId, nodeId, updateNodeData],
  );

  if (!node || !projectId) return null;

  const category = node.data.category;

  return (
    <div className="flex w-full flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b border-cm-border-primary px-4 py-3">
        <div className="min-w-0 flex-1">
          <EditableLabel
            value={node.data.label}
            onCommit={handleRename}
            className="text-sm font-medium text-cm-text-primary"
          />
          <p className="text-xs text-cm-text-tertiary capitalize mt-0.5">{category} node</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => selectNode(projectId, null)}
            title="Back to Chat"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => selectNode(projectId, null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {category === "transform" && (
        <Tabs defaultValue="mappings" className="flex flex-col">
          <TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
            <TabsTrigger value="mappings" className="text-xs">Mappings</TabsTrigger>
            <TabsTrigger value="confirmed" className="text-xs">Confirmed</TabsTrigger>
          </TabsList>
          <TabsContent value="mappings" className="px-4 pb-4">
            <MappingsTab />
          </TabsContent>
          <TabsContent value="confirmed" className="px-4 pb-4">
            <ConfirmedTab />
          </TabsContent>
        </Tabs>
      )}

      {category === "quality" && (
        <div className="p-4">
          <p className="text-sm text-cm-text-secondary">
            Quality checks will run automatically when the pipeline executes. No configuration needed.
          </p>
        </div>
      )}

      {category === "sink" && (
        <Tabs defaultValue="status" className="flex flex-col">
          <TabsList className="mx-4 mt-3">
            <TabsTrigger value="status" className="text-xs">Store Status</TabsTrigger>
          </TabsList>
          <TabsContent value="status" className="px-4 pb-4">
            <StoreStatusTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
