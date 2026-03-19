import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { PipelineNode } from "@/lib/types";
import { FileUp, Upload } from "lucide-react";
import { useNodeRename } from "@/hooks/use-node-rename";
import { NodeLabelInput } from "@/components/canvas/nodes/node-label-input";

const STATUS_COLORS: Record<string, string> = {
  ready: "bg-emerald-500",
  running: "bg-amber-500 animate-pulse",
  warning: "bg-amber-500",
  error: "bg-red-500",
  idle: "bg-slate-300",
};

export function SourceNode({ id, data }: NodeProps<PipelineNode>) {
  const rename = useNodeRename(id, data.label);
  const hasData = data.status !== "idle" && data.rowCount;

  return (
    <div className="relative w-[180px] rounded-lg border border-cm-border-primary bg-white shadow-sm">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-cm-node-source" />
      <div className="p-3 pl-4">
        <div className="flex items-center gap-2">
          {hasData ? (
            <FileUp className="h-4 w-4 shrink-0 text-cm-node-source" />
          ) : (
            <Upload className="h-4 w-4 shrink-0 text-cm-text-tertiary" />
          )}
          <NodeLabelInput rename={rename} />
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-cm-text-tertiary">
          {hasData ? (
            <>
              <span>{data.rowCount!.toLocaleString()} rows</span>
              {data.columnCount && (
                <span className="text-cm-border-strong">· {data.columnCount} cols</span>
              )}
            </>
          ) : (
            <span className="italic">Click to upload</span>
          )}
          <div
            className={`ml-auto h-2 w-2 rounded-full ${STATUS_COLORS[data.status]}`}
          />
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !bg-cm-node-source"
      />
    </div>
  );
}
