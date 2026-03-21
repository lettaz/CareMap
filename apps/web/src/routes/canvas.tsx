import { useEffect, useRef } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { NodePalette } from "@/components/canvas/node-palette";
import { useActiveProject } from "@/hooks/use-active-project";
import { usePipelineStore } from "@/lib/stores/pipeline-store";

export default function CanvasPage() {
  const { projectId } = useActiveProject();
  const loadPipeline = usePipelineStore((s) => s.loadPipeline);
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (projectId && loadedRef.current !== projectId) {
      loadedRef.current = projectId;
      loadPipeline(projectId);
    }
  }, [projectId, loadPipeline]);

  if (!projectId) return null;

  return (
    <ReactFlowProvider>
      <div data-tour="canvas-area" className="relative flex h-full">
        <div className="relative flex-1">
          <FlowCanvas />
          <NodePalette />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
