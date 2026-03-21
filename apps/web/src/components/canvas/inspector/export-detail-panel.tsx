import { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  X,
  Download,
  Loader2,
  Play,
  Table2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { EditableLabel } from "@/components/shared/editable-label";
import { triggerPipeline } from "@/lib/api/pipeline";
import { fetchHarmonizedTables, type HarmonizedTableDTO } from "@/lib/api/harmonize";
import { cn } from "@/lib/utils";

const FORMAT_OPTIONS = [
  { id: "csv", label: "CSV" },
  { id: "json", label: "JSON" },
  { id: "xlsx", label: "Excel" },
  { id: "parquet", label: "Parquet" },
] as const;

interface ExportDetailPanelProps {
  nodeId: string;
}

export function ExportDetailPanel({ nodeId }: ExportDetailPanelProps) {
  const { projectId } = useActiveProject();
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined,
  );
  const selectNode = usePipelineStore((s) => s.selectNode);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const openPanel = useAgentStore((s) => s.openPanel);

  const [tables, setTables] = useState<HarmonizedTableDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const format = (node?.data.format as string) ?? "csv";

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetchHarmonizedTables(projectId)
      .then((res) => setTables(res.tables ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleFormatChange = useCallback(
    (fmt: string) => {
      if (!projectId) return;
      updateNodeData(projectId, nodeId, { format: fmt });
    },
    [projectId, nodeId, updateNodeData],
  );

  const handleRun = useCallback(async () => {
    if (!projectId) return;
    setRunning(true);
    setError(null);
    updateNodeData(projectId, nodeId, { status: "running" });

    try {
      const { url, body } = triggerPipeline(projectId, nodeId, "export_requested");
      const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
      const response = await fetch(`${apiBase}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.message ?? `Server returned ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }

      updateNodeData(projectId, nodeId, { status: "ready" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      updateNodeData(projectId, nodeId, { status: "error" });
    } finally {
      setRunning(false);
    }
  }, [projectId, nodeId, updateNodeData]);

  const handleViewChat = useCallback(() => {
    if (!projectId) return;
    selectNode(projectId, null);
    openPanel();
  }, [projectId, selectNode, openPanel]);

  if (!node || !projectId) return null;

  const hasTables = tables.length > 0;
  const isRunning = running || node.data.status === "running";
  const totalRows = tables.reduce((sum, t) => sum + t.rows, 0);

  return (
    <div className="flex w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-cm-border-primary px-4 py-3 shrink-0">
        <div className="min-w-0 flex-1">
          <EditableLabel
            value={node.data.label}
            onCommit={(v) => updateNodeData(projectId, nodeId, { label: v })}
            className="text-sm font-medium text-cm-text-primary"
          />
          <p className="text-xs text-cm-text-tertiary mt-0.5">
            Export harmonized data as {format.toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleViewChat} title="Back to Chat">
            <MessageCircle className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => selectNode(projectId, null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Format selector */}
        <div className="p-4 border-b border-cm-border-subtle space-y-3">
          <p className="text-xs font-medium text-cm-text-primary">Export Format</p>
          <div className="flex gap-1.5">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleFormatChange(opt.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
                  format === opt.id
                    ? "bg-cm-node-sink text-white"
                    : "bg-cm-bg-elevated text-cm-text-secondary hover:bg-cm-bg-hover",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action */}
        <div className="p-4 space-y-3 border-b border-cm-border-subtle">
          <Button
            onClick={handleRun}
            disabled={isRunning || !hasTables}
            className="w-full gap-2"
            variant="default"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? "Exporting..." : "Run Export"}
          </Button>

          {!hasTables && !loading && (
            <div className="flex items-start gap-2 rounded-md border border-cm-warning/30 bg-cm-warning-subtle p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-cm-warning shrink-0 mt-0.5" />
              <p className="text-[11px] text-cm-warning leading-snug">
                No harmonized data available. Run harmonization first.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-cm-error/30 bg-cm-error-subtle p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-cm-error shrink-0 mt-0.5" />
              <p className="text-[11px] text-cm-error leading-snug">{error}</p>
            </div>
          )}
        </div>

        {/* Tables overview */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-cm-accent" />
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Download className="h-8 w-8 text-cm-node-sink/30" />
            <p className="text-sm text-cm-text-secondary">No data to export</p>
            <p className="text-xs text-cm-text-tertiary">
              Harmonized tables will appear here after running harmonization.
            </p>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-cm-border-subtle">
              <p className="text-xs font-medium text-cm-text-primary">
                Available Tables ({tables.length})
              </p>
              <p className="text-[10px] text-cm-text-tertiary mt-0.5">
                {totalRows.toLocaleString()} total rows across all tables
              </p>
            </div>
            <div className="divide-y divide-cm-border-subtle">
              {tables.map((t) => (
                <div key={t.name} className="flex items-center gap-3 px-4 py-2.5">
                  <Table2 className="h-3.5 w-3.5 text-cm-node-sink shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[11px] font-medium text-cm-text-primary">{t.name}</p>
                  </div>
                  <span className="text-[10px] tabular-nums text-cm-text-tertiary">
                    {t.rows.toLocaleString()} rows
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-cm-border-primary bg-cm-bg-surface px-3 py-2 text-[10px] text-cm-text-tertiary">
        <Download className="inline h-3 w-3 mr-1" />
        Output: {format.toUpperCase()} · {tables.length} tables
      </div>
    </div>
  );
}
