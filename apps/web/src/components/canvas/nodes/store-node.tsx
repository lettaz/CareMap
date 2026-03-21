import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { PipelineNode } from "@/lib/types";
import { Database, Clock } from "lucide-react";
import { useNodeRename } from "@/hooks/use-node-rename";
import { useNodeHover } from "@/hooks/use-node-hover";
import { NodeLabelInput } from "./node-label-input";
import { NodeActionToolbar } from "./node-action-toolbar";
import { cn } from "@/lib/utils";

function formatSyncTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function StoreNode({ id, data }: NodeProps<PipelineNode>) {
  const rename = useNodeRename(id, data.label);
  const { isHovered, hoverProps } = useNodeHover();
  const hasData = data.rowCount != null && data.rowCount > 0;
  const hasIssues = (data.issueCount ?? 0) > 0;
  const isWarningOrError = data.status === "warning" || data.status === "error";
  const isStale = !!data.stale;
  const formatLabel = data.format ?? data.targetTable ?? "canonical";

  const description =
    data.description ??
    (hasData
      ? `Writing validated data to canonical Supabase tables`
      : data.targetTable
        ? `Writing to ${data.targetTable}`
        : "Persists harmonized data to canonical tables");

  return (
    <div
      className="relative w-[260px] rounded-lg border border-cm-border-primary bg-white shadow-sm transition-shadow hover:shadow-md"
      {...hoverProps}
    >
      <NodeActionToolbar nodeId={id} label={data.label} category="sink" status={data.status} isVisible={isHovered} />
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-cm-node-sink",
        hasData && "w-1.5",
      )} />

      {isStale && !hasIssues && !isWarningOrError && (
        <div className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-amber-400" title="Upstream data changed — re-export recommended">
          <span className="text-[9px] font-bold leading-none text-white">!</span>
        </div>
      )}
      {(hasIssues || isWarningOrError) && (
        <div className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500">
          <span className="text-[9px] font-bold leading-none text-white">
            {data.issueCount ?? "!"}
          </span>
        </div>
      )}

      <div className="p-3 pl-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-cm-node-sink/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cm-node-sink">
            Store
          </span>
          <div className="flex items-center gap-1.5">
            <span className="rounded border border-cm-border-primary bg-cm-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-cm-text-secondary">
              {formatLabel}
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
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cm-node-sink/10">
            <Database className="h-3.5 w-3.5 text-cm-node-sink" />
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
                <span className="font-semibold text-cm-text-primary">{data.rowCount!.toLocaleString()}</span> rows written
              </span>
              {data.lastSyncAt && (
                <span className="flex items-center gap-1 text-[10px] text-cm-text-tertiary">
                  <Clock className="h-3 w-3" />
                  {formatSyncTime(data.lastSyncAt)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] italic text-cm-text-tertiary">
              Awaiting harmonized data
            </span>
          )}
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-cm-node-sink"
      />
    </div>
  );
}
