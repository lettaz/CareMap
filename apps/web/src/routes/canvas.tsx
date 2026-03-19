import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { NodePalette } from "@/components/canvas/node-palette";
import { useActiveProject } from "@/hooks/use-active-project";

export default function CanvasPage() {
  const { projectId } = useActiveProject();

  if (!projectId) return null;

  return (
    <div className="relative flex h-full">
      <div className="relative flex-1">
        <FlowCanvas />
        <NodePalette />
      </div>
    </div>
  );
}
