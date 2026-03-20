import { useState } from "react";
import { Plus, FileUp, Shuffle, Layers, Download, ShieldCheck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useActiveProject } from "@/hooks/use-active-project";
import type { NodeCategory, PipelineNode } from "@/lib/types";

const NODE_HEIGHT = 160;
const NODE_GAP = 24;

const CATEGORY_X: Record<NodeCategory, number> = {
  source: 50,
  transform: 350,
  harmonize: 600,
  quality: 850,
  sink: 1100,
};

const NODE_OPTIONS = [
  { category: "source" as NodeCategory, label: "Source", icon: FileUp, color: "text-cm-node-source", bg: "bg-cm-node-source-subtle", desc: "Upload a CSV, XLSX or TXT file" },
  { category: "transform" as NodeCategory, label: "Transform", icon: Shuffle, color: "text-cm-node-transform", bg: "bg-cm-node-transform-subtle", desc: "Map & join fields across sources" },
  { category: "harmonize" as NodeCategory, label: "Harmonize", icon: Layers, color: "text-cm-node-harmonize", bg: "bg-cm-node-harmonize-subtle", desc: "Merge accepted mappings into canonical tables" },
  { category: "quality" as NodeCategory, label: "Quality Check", icon: ShieldCheck, color: "text-cm-node-quality", bg: "bg-cm-node-quality-subtle", desc: "Validate data integrity and quality rules" },
  { category: "sink" as NodeCategory, label: "Output", icon: Download, color: "text-cm-node-sink", bg: "bg-cm-node-sink-subtle", desc: "Export in CSV, JSON, XLSX or Parquet" },
];

export function NodePalette() {
  const [open, setOpen] = useState(false);
  const { projectId } = useActiveProject();
  const addNode = usePipelineStore((s) => s.addNode);
  const selectNode = usePipelineStore((s) => s.selectNode);

  const nodes = usePipelineStore(
    (s) => (projectId ? s.pipelines[projectId]?.nodes : undefined) ?? [],
  );

  const handleAdd = (category: NodeCategory, label: string) => {
    if (!projectId) return;
    const id = `${category}-${Date.now()}`;
    const x = CATEGORY_X[category] ?? 250;
    const sameCol = nodes.filter(
      (n) => Math.abs(n.position.x - x) < 100,
    );
    const maxY = sameCol.length
      ? Math.max(...sameCol.map((n) => n.position.y))
      : -NODE_GAP;
    const y = maxY + NODE_HEIGHT + NODE_GAP;

    const node: PipelineNode = {
      id,
      type: category === "sink" ? "sink" : category,
      position: { x, y },
      data: { category, status: "idle", label },
    };
    addNode(projectId, node);
    selectNode(projectId, id);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger data-tour="node-palette-btn" className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-cm-accent text-white shadow-md transition-colors hover:opacity-90">
        <Plus className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="max-w-[280px] bg-cm-bg-surface">
        <SheetHeader>
          <SheetTitle className="text-cm-text-primary">Add Node</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2 px-4">
          {NODE_OPTIONS.map(({ category, label, icon: Icon, color, bg, desc }) => (
            <button
              key={label}
              onClick={() => handleAdd(category, label)}
              className="flex w-full items-center gap-3 rounded-lg border border-cm-border-primary p-3 text-left transition-colors hover:bg-cm-bg-elevated"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-md ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-cm-text-primary">{label}</p>
                <p className="text-xs text-cm-text-tertiary">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
