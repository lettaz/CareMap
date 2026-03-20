import { X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { UploadTab } from "./upload-tab";
import { ProfileTab } from "./profile-tab";
import { MappingsTab } from "./mappings-tab";
import { ConfirmedTab } from "./confirmed-tab";
import { StoreStatusTab } from "./store-status-tab";
import { QualityCheckTab } from "./quality-check-tab";

interface InspectorPanelProps {
  nodeId: string;
}

export function InspectorPanel({ nodeId }: InspectorPanelProps) {
  const { projectId } = useActiveProject();
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined
  );
  const selectNode = usePipelineStore((s) => s.selectNode);

  if (!node || !projectId) return null;

  const category = node.data.category;

  return (
    <div className="w-[360px] shrink-0 border-l border-cm-border-primary bg-cm-bg-surface overflow-y-auto">
      <div className="flex items-center justify-between border-b border-cm-border-primary px-4 py-3">
        <div>
          <p className="text-sm font-medium text-cm-text-primary">{node.data.label}</p>
          <p className="text-xs text-cm-text-tertiary capitalize">{category} node</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => selectNode(projectId, null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {category === "source" && (
        <Tabs defaultValue="upload" className="flex flex-col">
          <TabsList className="mx-4 mt-3 grid w-auto grid-cols-3">
            <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
            <TabsTrigger value="profile" className="text-xs">Profile</TabsTrigger>
            <TabsTrigger value="mappings" className="text-xs">Mappings</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="px-4 pb-4">
            <UploadTab />
          </TabsContent>
          <TabsContent value="profile" className="px-4 pb-4">
            <ProfileTab sourceFileId={node.data.sourceFileId ?? nodeId} />
          </TabsContent>
          <TabsContent value="mappings" className="px-4 pb-4">
            <MappingsTab sourceFileId={node.data.sourceFileId ?? nodeId} />
          </TabsContent>
        </Tabs>
      )}

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
        <QualityCheckTab nodeId={nodeId} />
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
