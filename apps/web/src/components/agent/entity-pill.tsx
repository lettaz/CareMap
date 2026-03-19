import { Table2, Columns3, FileSpreadsheet, BarChart3 } from "lucide-react";
import type { EntityRef } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON_MAP = {
  table: Table2,
  column: Columns3,
  source: FileSpreadsheet,
  chart: BarChart3,
} as const;

interface EntityPillProps {
  entity: EntityRef;
  className?: string;
}

export function EntityPill({ entity, className }: EntityPillProps) {
  const Icon = ICON_MAP[entity.type];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-cm-border-primary bg-cm-bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-cm-text-primary align-middle cursor-default hover:bg-cm-bg-hover transition-colors",
        className,
      )}
    >
      <Icon className="h-3 w-3 text-cm-text-tertiary shrink-0" />
      {entity.hash && (
        <span className="text-cm-accent font-mono text-[10px]">{entity.hash}</span>
      )}
      <span className="truncate max-w-[180px]">{entity.label}</span>
    </span>
  );
}
