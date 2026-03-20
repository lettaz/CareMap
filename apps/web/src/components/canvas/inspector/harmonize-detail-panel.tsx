import { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  X,
  Layers,
  Loader2,
  Play,
  Table2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { EditableLabel } from "@/components/shared/editable-label";
import { triggerPipeline } from "@/lib/api/pipeline";
import { fetchHarmonizedTables, type HarmonizedTableDTO } from "@/lib/api/harmonize";
import { fetchMappings } from "@/lib/api/mappings";
import { cn } from "@/lib/utils";

interface HarmonizeDetailPanelProps {
  nodeId: string;
}

export function HarmonizeDetailPanel({ nodeId }: HarmonizeDetailPanelProps) {
  const { projectId } = useActiveProject();
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined,
  );
  const selectNode = usePipelineStore((s) => s.selectNode);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const openPanel = useAgentStore((s) => s.openPanel);

  const [tables, setTables] = useState<HarmonizedTableDTO[]>([]);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [harmonized, mappings] = await Promise.all([
        fetchHarmonizedTables(projectId),
        fetchMappings(projectId, { page: 1, pageSize: 200 }),
      ]);
      setTables(harmonized.tables ?? []);
      setAcceptedCount(mappings.data.filter((m) => m.status === "accepted").length);
    } catch { /* silent */ }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRun = useCallback(async () => {
    if (!projectId) return;
    setRunning(true);
    setError(null);
    updateNodeData(projectId, nodeId, { status: "running" });

    try {
      const { url, body } = triggerPipeline(projectId, nodeId, "harmonize_requested");
      const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
      const response = await fetch(`${apiBase}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          if (text.includes('"type":"complete"')) {
            break;
          }
          if (text.includes('"type":"error"')) {
            const match = text.match(/"message":"([^"]+)"/);
            setError(match?.[1] ?? "Harmonization failed");
            updateNodeData(projectId, nodeId, { status: "error" });
            setRunning(false);
            return;
          }
        }
      }

      await loadData();
      const freshTables = tables;
      const totalRows = freshTables.reduce((sum, t) => sum + t.rows, 0);
      updateNodeData(projectId, nodeId, {
        status: "ready",
        tableCount: freshTables.length,
        harmonizedRowCount: totalRows,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Harmonization failed");
      updateNodeData(projectId, nodeId, { status: "error" });
    } finally {
      setRunning(false);
    }
  }, [projectId, nodeId, updateNodeData, loadData, tables]);

  const handleViewChat = useCallback(() => {
    if (!projectId) return;
    selectNode(projectId, null);
    openPanel();
  }, [projectId, selectNode, openPanel]);

  if (!node || !projectId) return null;

  const totalRows = tables.reduce((sum, t) => sum + t.rows, 0);
  const isRunning = running || node.data.status === "running";
  const hasPrereqs = acceptedCount > 0;

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
            {tables.length} harmonized tables · {totalRows.toLocaleString()} rows
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
        {/* Action section */}
        <div className="p-4 space-y-3 border-b border-cm-border-subtle">
          <Button
            onClick={handleRun}
            disabled={isRunning || !hasPrereqs}
            className="w-full gap-2"
            variant="default"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? "Harmonizing..." : "Run Harmonize"}
          </Button>

          {!hasPrereqs && !loading && (
            <div className="flex items-start gap-2 rounded-md border border-cm-warning/30 bg-cm-warning-subtle p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-cm-warning shrink-0 mt-0.5" />
              <p className="text-[11px] text-cm-warning leading-snug">
                No accepted mappings found. Review and accept field mappings in the Transform node first.
              </p>
            </div>
          )}

          {hasPrereqs && !isRunning && (
            <p className="text-[11px] text-cm-text-tertiary">
              {acceptedCount} accepted mapping{acceptedCount !== 1 ? "s" : ""} ready for harmonization.
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-cm-error/30 bg-cm-error-subtle p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-cm-error shrink-0 mt-0.5" />
              <p className="text-[11px] text-cm-error leading-snug">{error}</p>
            </div>
          )}
        </div>

        {/* Running banner */}
        {isRunning && (
          <div className="flex items-center gap-2.5 border-b border-cm-node-harmonize/20 bg-cm-node-harmonize-subtle px-4 py-2.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cm-node-harmonize shrink-0" />
            <p className="text-[11px] text-cm-node-harmonize font-medium flex-1">
              Merging source data into canonical tables...
            </p>
            <button
              onClick={handleViewChat}
              className="text-[10px] font-medium text-cm-node-harmonize underline underline-offset-2 shrink-0"
            >
              View in Chat
            </button>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-cm-accent" />
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Layers className="h-8 w-8 text-cm-node-harmonize/30" />
            <p className="text-sm text-cm-text-secondary">No harmonized tables yet</p>
            <p className="text-xs text-cm-text-tertiary">
              Run harmonization to merge source data into canonical tables.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-cm-border-subtle">
            {tables.map((t) => (
              <div key={t.name} className="flex items-center gap-3 px-4 py-3 hover:bg-cm-bg-elevated/50 transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cm-node-harmonize/10">
                  <Table2 className="h-4 w-4 text-cm-node-harmonize" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-medium text-cm-text-primary">{t.name}</p>
                  <p className="text-[10px] text-cm-text-tertiary">
                    {t.columns.length} columns · {t.rows.toLocaleString()} rows
                  </p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-cm-success shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-cm-border-primary bg-cm-bg-surface px-3 py-2 text-[10px] text-cm-text-tertiary">
        <Layers className="inline h-3 w-3 mr-1" />
        {acceptedCount} accepted mappings · {tables.length} output tables
      </div>
    </div>
  );
}
