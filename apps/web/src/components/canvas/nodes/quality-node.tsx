import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { PipelineNode } from "@/lib/types";
import { ShieldCheck, CircleCheck, AlertTriangle, CircleX } from "lucide-react";
import { useNodeRename } from "@/hooks/use-node-rename";
import { useNodeHover } from "@/hooks/use-node-hover";
import { NodeLabelInput } from "./node-label-input";
import { NodeActionToolbar } from "./node-action-toolbar";
import { cn } from "@/lib/utils";

export function QualityNode({ id, data }: NodeProps<PipelineNode>) {
  const rename = useNodeRename(id, data.label);
  const { isHovered, hoverProps } = useNodeHover();
  const pass = data.checksPass ?? 0;
  const warn = data.checksWarn ?? 0;
  const fail = data.checksFail ?? 0;
  const totalChecks = pass + warn + fail;
  const hasResults = totalChecks > 0;
  const hasIssues = fail > 0 || (data.issueCount ?? 0) > 0;
  const isWarningOrError = data.status === "warning" || data.status === "error";
  const isStale = !!data.stale;

  const description =
    data.description ??
    (hasResults
      ? `Validated ${data.rowCount?.toLocaleString() ?? 0} rows across ${totalChecks} integrity and range checks`
      : "Validates data integrity and quality rules");

  return (
    <div
      className="relative w-[260px] rounded-lg border border-cm-border-primary bg-white shadow-sm transition-shadow hover:shadow-md"
      {...hoverProps}
    >
      <NodeActionToolbar nodeId={id} label={data.label} category="quality" status={data.status} isVisible={isHovered} />
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-cm-node-quality",
        hasResults && "w-1.5",
      )} />

      {isStale && !hasIssues && !isWarningOrError && (
        <div className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-amber-400" title="Upstream source changed — re-run recommended">
          <span className="text-[9px] font-bold leading-none text-white">!</span>
        </div>
      )}
      {(hasIssues || isWarningOrError) && (
        <div className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500">
          <span className="text-[9px] font-bold leading-none text-white">
            {fail > 0 ? fail : (data.issueCount ?? "!")}
          </span>
        </div>
      )}

      <div className="p-3 pl-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-cm-node-quality/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cm-node-quality">
            Quality
          </span>
          <div
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              data.status === "ready" && "bg-emerald-500",
              data.status === "running" && "bg-amber-500 animate-pulse",
              data.status === "warning" && "bg-amber-500",
              data.status === "error" && "bg-red-500",
              data.status === "idle" && "bg-slate-300",
              hasResults && warn > 0 && data.status !== "error" && "bg-amber-500",
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cm-node-quality/10">
            <ShieldCheck className="h-3.5 w-3.5 text-cm-node-quality" />
          </div>
          <NodeLabelInput rename={rename} />
        </div>

        <p className="mt-1.5 text-[11px] leading-snug text-cm-text-tertiary">
          {description}
        </p>

        <div className="mt-2 border-t border-cm-border-subtle pt-2">
          {hasResults ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                <CircleCheck className="h-3 w-3" />
                {pass}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {warn}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-red-600">
                <CircleX className="h-3 w-3" />
                {fail}
              </span>
              {data.rowCount != null && data.rowCount > 0 && (
                <span className="ml-auto text-[11px] tabular-nums text-cm-text-tertiary">
                  {data.rowCount.toLocaleString()} rows
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] italic text-cm-text-tertiary">
              No checks run yet
            </span>
          )}
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-cm-node-quality"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-cm-node-quality"
      />
    </div>
  );
}
