import { useState, useCallback, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useAgentStore } from "@/lib/stores/agent-store";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { AgentPanel } from "./agent-panel";
import { SourceDetailPanel } from "@/components/canvas/inspector/source-detail-panel";
import { MappingDetailPanel } from "@/components/canvas/inspector/mapping-detail-panel";
import { NodeInspector } from "@/components/canvas/inspector/node-inspector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RightPanelProps {
  isCanvasRoute: boolean;
}

const DEFAULT_WIDTHS = {
  agent: 420,
  source: 580,
  transform: 560,
  default: 420,
} as const;

const MIN_WIDTH = 320;
const MAX_WIDTH = 900;

export function RightPanel({ isCanvasRoute }: RightPanelProps) {
  const { projectId } = useActiveProject();
  const isPanelOpen = useAgentStore((s) => s.isPanelOpen);
  const togglePanel = useAgentStore((s) => s.togglePanel);
  const isMobile = useIsMobile();

  const selectedNodeId = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.selectedNodeId : null
  );
  const selectedNode = usePipelineStore((s) => {
    if (!projectId || !selectedNodeId) return null;
    return s.pipelines[projectId]?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  });

  const showInspector = isCanvasRoute && selectedNode !== null;
  const nodeCategory = selectedNode?.data.category ?? null;

  const baseWidth = !isPanelOpen
    ? 0
    : showInspector
      ? nodeCategory === "source"
        ? DEFAULT_WIDTHS.source
        : nodeCategory === "transform"
          ? DEFAULT_WIDTHS.transform
          : DEFAULT_WIDTHS.default
      : DEFAULT_WIDTHS.agent;

  const [panelWidth, setPanelWidth] = useState(baseWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    setPanelWidth(baseWidth);
  }, [baseWidth]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [panelWidth, isMobile]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setPanelWidth(next);
    }

    function onMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  if (!isPanelOpen) return null;

  const panelContent = showInspector ? (
    nodeCategory === "source" ? (
      <SourceDetailPanel nodeId={selectedNode!.id} />
    ) : nodeCategory === "transform" ? (
      <MappingDetailPanel nodeId={selectedNode!.id} />
    ) : (
      <NodeInspector nodeId={selectedNode!.id} />
    )
  ) : (
    <AgentPanel />
  );

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/40 animate-in fade-in"
          onClick={togglePanel}
        />
        {/* Full-screen panel */}
        <div className="fixed inset-x-0 bottom-0 top-12 z-50 flex flex-col bg-cm-bg-surface animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between border-b border-cm-border-primary px-3 py-2 shrink-0">
            <p className="text-xs font-medium text-cm-text-secondary uppercase tracking-wider">
              {showInspector ? "Inspector" : "CareMap AI"}
            </p>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={togglePanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            {panelContent}
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className="relative flex h-full shrink-0 overflow-hidden border-l border-cm-border-primary bg-cm-bg-surface"
      style={{ width: panelWidth, minWidth: 0 }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className={cn(
          "absolute left-0 top-0 bottom-0 z-20 w-1.5 cursor-col-resize",
          "hover:bg-cm-accent/40 active:bg-cm-accent/60 transition-colors"
        )}
      />

      <div className="flex h-full w-full flex-col overflow-hidden">
        {panelContent}
      </div>
    </div>
  );
}
