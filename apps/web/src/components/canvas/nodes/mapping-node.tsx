import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { PipelineNode } from "@/lib/types";
import { Shuffle } from "lucide-react";
import { useNodeRename } from "@/hooks/use-node-rename";
import { NodeLabelInput } from "./node-label-input";
import { cn } from "@/lib/utils";

export function MappingNode({ id, data }: NodeProps<PipelineNode>) {
  const rename = useNodeRename(id, data.label);
  const mapped = data.mappedCount ?? 0;
  const total = data.totalFields ?? data.columnCount ?? 0;
  const progressPct = total > 0 ? Math.round((mapped / total) * 100) : 0;
  const hasIssues = (data.issueCount ?? 0) > 0;
  const isWarningOrError = data.status === "warning" || data.status === "error";

  const description =
    data.description ??
    (data.sourceCount
      ? `Aligning ${data.sourceCount} source${data.sourceCount !== 1 ? "s" : ""} to canonical model`
      : "Connect sources to begin mapping");

  return (
    <div className="relative w-[260px] rounded-lg border border-cm-border-primary bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-cm-node-transform" />

      {(hasIssues || isWarningOrError) && (
        <div className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500">
          <span className="text-[9px] font-bold leading-none text-white">
            {data.issueCount ?? "!"}
          </span>
        </div>
      )}

      <div className="p-3 pl-4">
        {/* Badge + Status */}
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-cm-node-transform/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cm-node-transform">
            Transform
          </span>
          <div className="flex items-center gap-1.5">
            {data.confidenceAvg != null && (
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                data.confidenceAvg >= 80 ? "bg-emerald-50 text-emerald-600" :
                data.confidenceAvg >= 60 ? "bg-amber-50 text-amber-600" :
                "bg-red-50 text-red-600",
              )}>
                {data.confidenceAvg}% conf
              </span>
            )}
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
        </div>

        {/* Icon + Label */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cm-node-transform/10">
            <Shuffle className="h-3.5 w-3.5 text-cm-node-transform" />
          </div>
          <NodeLabelInput rename={rename} />
        </div>

        {/* Description */}
        <p className="mt-1.5 text-[11px] leading-snug text-cm-text-tertiary">
          {description}
        </p>

        {/* Progress bar */}
        {total > 0 && (
          <div className="mt-2 border-t border-cm-border-subtle pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-cm-text-secondary">
                <span className="font-semibold text-cm-text-primary">{mapped}</span>/{total} fields mapped
              </span>
              <span className="text-[10px] font-medium tabular-nums text-cm-text-tertiary">
                {progressPct}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-cm-bg-elevated">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  progressPct === 100 ? "bg-emerald-500" :
                  progressPct >= 50 ? "bg-cm-node-transform" :
                  "bg-amber-500",
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Fallback stats if no mapping data */}
        {total === 0 && (
          <div className="mt-2 border-t border-cm-border-subtle pt-2">
            <span className="text-[11px] italic text-cm-text-tertiary">
              Awaiting source connections
            </span>
          </div>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-cm-node-transform"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-cm-node-transform"
      />
    </div>
  );
}
