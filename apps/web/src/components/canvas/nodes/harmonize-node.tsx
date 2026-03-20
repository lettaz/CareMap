import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { PipelineNode } from "@/lib/types";
import { Layers, Clock } from "lucide-react";
import { useNodeRename } from "@/hooks/use-node-rename";
import { NodeLabelInput } from "./node-label-input";
import { cn } from "@/lib/utils";

export function HarmonizeNode({ id, data }: NodeProps<PipelineNode>) {
  const rename = useNodeRename(id, data.label);
  const tableCount = data.tableCount ?? 0;
  const rowCount = data.harmonizedRowCount ?? data.rowCount ?? 0;
  const hasData = tableCount > 0 || rowCount > 0;
  const hasIssues = (data.issueCount ?? 0) > 0;
  const isWarningOrError = data.status === "warning" || data.status === "error";

  const description =
    data.description ??
    (hasData
      ? `${tableCount} table${tableCount !== 1 ? "s" : ""} · ${rowCount.toLocaleString()} rows merged`
      : "Merge accepted mappings into canonical tables");

  return (
    <div className="relative w-[260px] rounded-lg border border-cm-border-primary bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-cm-node-harmonize",
        hasData && "w-1.5",
      )} />

      {(hasIssues || isWarningOrError) && (
        <div className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500">
          <span className="text-[9px] font-bold leading-none text-white">
            {data.issueCount ?? "!"}
          </span>
        </div>
      )}

      <div className="p-3 pl-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-cm-node-harmonize/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cm-node-harmonize">
            Harmonize
          </span>
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              data.status === "ready" && "bg-emerald-500",
              data.status === "running" && "bg-amber-500 animate-pulse",
              data.status === "warning" && "bg-amber-500",
              data.status === "error" && "bg-red-500",
              data.status === "idle" && "bg-slate-300",
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cm-node-harmonize/10">
            <Layers className="h-3.5 w-3.5 text-cm-node-harmonize" />
          </div>
          <NodeLabelInput rename={rename} />
        </div>

        <p className="mt-1.5 text-[11px] leading-snug text-cm-text-tertiary">
          {description}
        </p>

        <div className="mt-2 border-t border-cm-border-subtle pt-2">
          {hasData ? (
            <div className="flex items-center justify-between">
              <span className="text-[11px] tabular-nums text-cm-text-secondary">
                <span className="font-semibold text-cm-text-primary">{tableCount}</span> table{tableCount !== 1 ? "s" : ""}
              </span>
              {rowCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-cm-text-tertiary">
                  <Clock className="h-3 w-3" />
                  {rowCount.toLocaleString()} rows
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] italic text-cm-text-tertiary">
              Awaiting accepted mappings
            </span>
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-cm-node-harmonize"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-cm-node-harmonize"
      />
    </div>
  );
}
