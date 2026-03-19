import { useState } from "react";
import { Plus, FileUp, Shuffle, ShieldCheck, Database } from "lucide-react";
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

const NODE_OPTIONS = [
  { category: "source" as NodeCategory, label: "Source", icon: FileUp, color: "text-cm-node-source", bg: "bg-cm-node-source-subtle" },
  { category: "transform" as NodeCategory, label: "Transform", icon: Shuffle, color: "text-cm-node-transform", bg: "bg-cm-node-transform-subtle" },
  { category: "quality" as NodeCategory, label: "Quality", icon: ShieldCheck, color: "text-cm-node-quality", bg: "bg-cm-node-quality-subtle" },
  { category: "sink" as NodeCategory, label: "Sink", icon: Database, color: "text-cm-node-sink", bg: "bg-cm-node-sink-subtle" },
];

export function NodePalette() {
  const [open, setOpen] = useState(false);
  const { projectId } = useActiveProject();
  const addNode = usePipelineStore((s) => s.addNode);
  const selectNode = usePipelineStore((s) => s.selectNode);

  const handleAdd = (category: NodeCategory, label: string) => {
    if (!projectId) return;
    const id = `${category}-${Date.now()}`;
    const node: PipelineNode = {
      id,
      type: category,
      position: { x: 250 + Math.random() * 100, y: 200 + Math.random() * 100 },
      data: { category, status: "idle", label },
    };
    addNode(projectId, node);
    selectNode(projectId, id);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-cm-accent text-white shadow-md transition-colors hover:opacity-90">
        <Plus className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="max-w-[280px] bg-cm-bg-surface">
        <SheetHeader>
          <SheetTitle className="text-cm-text-primary">Add Node</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2 px-4">
          {NODE_OPTIONS.map(({ category, label, icon: Icon, color, bg }) => (
            <button
              key={category}
              onClick={() => handleAdd(category, label)}
              className="flex w-full items-center gap-3 rounded-lg border border-cm-border-primary p-3 text-left transition-colors hover:bg-cm-bg-elevated"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-md ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-cm-text-primary">{label}</p>
                <p className="text-xs text-cm-text-tertiary">Add a {label.toLowerCase()} node</p>
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
