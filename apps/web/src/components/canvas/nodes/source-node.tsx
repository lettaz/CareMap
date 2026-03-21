import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { PipelineNode } from "@/lib/types";
import { FileSpreadsheet, FileText, FileType2, Upload } from "lucide-react";
import { useNodeRename } from "@/hooks/use-node-rename";
import { useNodeHover } from "@/hooks/use-node-hover";
import { NodeLabelInput } from "@/components/canvas/nodes/node-label-input";
import { NodeActionToolbar } from "@/components/canvas/nodes/node-action-toolbar";
import { cn } from "@/lib/utils";

const FILE_TYPE_ICONS: Record<string, typeof FileSpreadsheet> = {
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  pdf: FileType2,
  txt: FileText,
};

const FILE_TYPE_LABELS: Record<string, string> = {
  csv: "CSV",
  xlsx: "Excel",
  pdf: "PDF",
  txt: "Text",
};

export function SourceNode({ id, data }: NodeProps<PipelineNode>) {
  const rename = useNodeRename(id, data.label);
  const { isHovered, hoverProps } = useNodeHover();
  const hasData = data.status !== "idle" && data.rowCount;
  const FileIcon = data.fileType ? FILE_TYPE_ICONS[data.fileType] ?? Upload : Upload;
  const hasIssues = (data.issueCount ?? 0) > 0;
  const isWarningOrError = data.status === "warning" || data.status === "error";

  return (
    <div
      className="relative w-[260px] rounded-lg border border-cm-border-primary bg-white shadow-sm transition-shadow hover:shadow-md"
      {...hoverProps}
    >
      <NodeActionToolbar
        nodeId={id}
        label={data.label}
        category="source"
        sourceFileId={data.sourceFileId as string | undefined}
        status={data.status}
        isVisible={isHovered}
      />
      {/* Category color bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-cm-node-source" />

      {/* Issue indicator dot */}
      {(hasIssues || isWarningOrError) && (
        <div className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500">
          <span className="text-[9px] font-bold leading-none text-white">
            {data.issueCount ?? "!"}
          </span>
        </div>
      )}

      <div className="p-3 pl-4">
        {/* Row 1: Badge + Status */}
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-cm-node-source/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cm-node-source">
            Source
          </span>
          <div className="flex items-center gap-1.5">
            {data.fileType && (
              <span className="rounded bg-cm-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-cm-text-secondary">
                {FILE_TYPE_LABELS[data.fileType] ?? data.fileType}
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

        {/* Row 2: Icon + Label */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cm-node-source/10">
            <FileIcon className="h-3.5 w-3.5 text-cm-node-source" />
          </div>
          <NodeLabelInput rename={rename} />
        </div>

        {/* Row 3: Description / Domain */}
        {data.domain && (
          <p className="mt-1.5 text-[11px] leading-snug text-cm-text-tertiary">
            {data.description ?? `${FILE_TYPE_LABELS[data.fileType ?? "csv"] ?? "File"} source · ${data.domain.replaceAll("_", " ")} domain`}
          </p>
        )}

        {/* Row 4: Stats footer */}
        <div className="mt-2 flex items-center gap-3 border-t border-cm-border-subtle pt-2">
          {hasData ? (
            <>
              <span className="text-[11px] tabular-nums text-cm-text-secondary">
                <span className="font-semibold text-cm-text-primary">{data.rowCount!.toLocaleString()}</span> rows
              </span>
              {data.columnCount && (
                <span className="text-[11px] tabular-nums text-cm-text-secondary">
                  <span className="font-semibold text-cm-text-primary">{data.columnCount}</span> cols
                </span>
              )}
            </>
          ) : data.status === "ready" ? (
            <span className="text-[11px] text-emerald-600 font-medium">
              Profiled
            </span>
          ) : (
            <span className="text-[11px] italic text-cm-text-tertiary">
              Click to upload file
            </span>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-cm-node-source"
      />
    </div>
  );
}
