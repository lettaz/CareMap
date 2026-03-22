import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageCircle,
  X,
  Layers,
  Loader2,
  Play,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { EditableLabel } from "@/components/shared/editable-label";
import {
  fetchHarmonizedTables,
  fetchTablePreview,
  type HarmonizedTableDTO,
  type TablePreviewDTO,
} from "@/lib/api/harmonize";
import { fetchMappings, type FieldMappingDTO } from "@/lib/api/mappings";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

interface HarmonizeDetailPanelProps {
  nodeId: string;
}

function formatTableName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseSSELines(raw: string): Array<{ type: string; data: Record<string, unknown> }> {
  const events: Array<{ type: string; data: Record<string, unknown> }> = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.startsWith("data: ") ? line.slice(6) : line.trim();
    if (!trimmed || !trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type) events.push(parsed);
    } catch { /* partial chunk */ }
  }
  return events;
}

function TableDataGrid({
  projectId,
  table,
}: {
  projectId: string;
  table: HarmonizedTableDTO;
}) {
  const [preview, setPreview] = useState<TablePreviewDTO | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(table.rows / PAGE_SIZE));

  const loadPage = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchTablePreview(projectId, table.name, PAGE_SIZE, p * PAGE_SIZE);
        setPreview(data);
        setPage(p);
        gridRef.current?.scrollTo({ top: 0 });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    },
    [projectId, table.name],
  );

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  if (error) {
    return <div className="p-4 text-[11px] text-cm-error">{error}</div>;
  }

  if (loading && !preview) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-cm-accent" />
      </div>
    );
  }

  if (!preview || preview.rows.length === 0) {
    return <div className="p-4 text-[11px] text-cm-text-tertiary italic">No rows in this table.</div>;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Column summary */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-cm-border-subtle bg-cm-bg-elevated/30 shrink-0">
        <CheckCircle2 className="h-3 w-3 text-cm-success shrink-0" />
        <span className="text-[10px] text-cm-text-secondary">
          {table.columns.length} columns · {table.rows.toLocaleString()} rows
        </span>
      </div>

      {/* Data grid */}
      <div ref={gridRef} className="flex-1 overflow-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-cm-bg-elevated">
              <th className="px-2.5 py-2 text-left text-[10px] font-semibold text-cm-text-tertiary uppercase tracking-wider border-b border-cm-border-subtle w-[1%] whitespace-nowrap">
                #
              </th>
              {preview.columns.map((col) => (
                <th
                  key={col}
                  className="px-2.5 py-2 text-left text-[10px] font-semibold text-cm-text-secondary uppercase tracking-wider whitespace-nowrap border-b border-cm-border-subtle"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(loading && "opacity-40 pointer-events-none transition-opacity")}>
            {preview.rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "transition-colors hover:bg-cm-accent/5",
                  i % 2 === 0 ? "bg-cm-bg-surface" : "bg-cm-bg-elevated/20",
                )}
              >
                <td className="px-2.5 py-1.5 text-cm-text-tertiary font-mono border-b border-cm-border-subtle/30 tabular-nums">
                  {page * PAGE_SIZE + i + 1}
                </td>
                {preview.columns.map((col) => (
                  <td
                    key={col}
                    className="px-2.5 py-1.5 text-cm-text-primary whitespace-nowrap border-b border-cm-border-subtle/30 max-w-[240px] truncate"
                    title={String(row[col] ?? "")}
                  >
                    {row[col] == null ? (
                      <span className="text-cm-text-tertiary/60 italic">null</span>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-cm-border-primary px-3 py-2 shrink-0 bg-cm-bg-surface">
          <p className="text-[10px] text-cm-text-tertiary tabular-nums">
            {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, table.rows).toLocaleString()} of {table.rows.toLocaleString()}
          </p>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 0 || loading} onClick={() => loadPage(0)} title="First page">
              <ChevronsLeft className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 0 || loading} onClick={() => loadPage(page - 1)} title="Previous">
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="px-2 text-[10px] text-cm-text-secondary tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page >= totalPages - 1 || loading} onClick={() => loadPage(page + 1)} title="Next">
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page >= totalPages - 1 || loading} onClick={() => loadPage(totalPages - 1)} title="Last page">
              <ChevronsRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
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
  const [acceptedMappings, setAcceptedMappings] = useState<FieldMappingDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressLines, setProgressLines] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const progressEndRef = useRef<HTMLDivElement>(null);
  const acceptedMappingIds = acceptedMappings.map((m) => m.id);
  const coveredColumns = new Set(acceptedMappings.map((m) => `${m.target_table}.${m.target_column}`)).size;

  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progressLines]);

  const loadData = useCallback(async () => {
    if (!projectId) return { tables: [] as HarmonizedTableDTO[], ids: [] as string[] };
    try {
      const [harmonized, mappings] = await Promise.all([
        fetchHarmonizedTables(projectId),
        fetchMappings(projectId, { page: 1, pageSize: 500 }),
      ]);
      const freshTables = harmonized.tables ?? [];
      const accepted = mappings.data.filter((m) => m.status === "accepted");
      setTables(freshTables);
      setAcceptedMappings(accepted);
      return { tables: freshTables, ids: accepted.map((m) => m.id) };
    } catch {
      return { tables: [] as HarmonizedTableDTO[], ids: [] as string[] };
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRun = useCallback(async () => {
    if (!projectId || acceptedMappingIds.length === 0) return;
    setRunning(true);
    setError(null);
    setProgressLines([]);
    updateNodeData(projectId, nodeId, { status: "running" });

    try {
      const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
      const response = await fetch(`${apiBase}/api/harmonize/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, mappingIds: acceptedMappingIds }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.message ?? `Server returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          for (const event of parseSSELines(text)) {
            if (event.type === "error") {
              throw new Error((event.data as { message?: string })?.message ?? "Harmonization failed");
            }
            if (event.type === "progress") {
              const msg = (event.data as { message?: string })?.message ?? "";
              setProgressLines((prev) => [...prev, ...msg.split("\n").filter((l) => l.trim())]);
            }
          }
        }
      }

      const fresh = await loadData();
      const totalRows = fresh.tables.reduce((sum, t) => sum + t.rows, 0);
      updateNodeData(projectId, nodeId, {
        status: fresh.tables.length > 0 ? "ready" : "idle",
        tableCount: fresh.tables.length,
        harmonizedRowCount: totalRows,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Harmonization failed");
      updateNodeData(projectId, nodeId, { status: "error" });
    } finally {
      setRunning(false);
    }
  }, [projectId, nodeId, updateNodeData, loadData, acceptedMappingIds]);

  const handleViewChat = useCallback(() => {
    if (!projectId) return;
    selectNode(projectId, null);
    openPanel();
  }, [projectId, selectNode, openPanel]);

  if (!node || !projectId) return null;

  const totalRows = tables.reduce((sum, t) => sum + t.rows, 0);
  const isRunning = running || node.data.status === "running";
  const hasPrereqs = acceptedMappingIds.length > 0;
  const currentTab = activeTab ?? tables[0]?.name;
  const currentTable = tables.find((t) => t.name === currentTab);

  return (
    <div className="flex w-full flex-col overflow-hidden">
      {/* Header */}
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

      {/* Action section */}
      <div className="p-4 space-y-3 border-b border-cm-border-subtle shrink-0">
        <Button
          onClick={handleRun}
          disabled={isRunning || !hasPrereqs}
          className="w-full gap-2"
          variant="default"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
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

        {hasPrereqs && !isRunning && progressLines.length === 0 && (
          <p className="text-[11px] text-cm-text-tertiary">
            {coveredColumns} mapped column{coveredColumns !== 1 ? "s" : ""} ready for harmonization.
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-cm-error/30 bg-cm-error-subtle p-2.5">
            <AlertTriangle className="h-3.5 w-3.5 text-cm-error shrink-0 mt-0.5" />
            <p className="text-[11px] text-cm-error leading-snug break-words">{error}</p>
          </div>
        )}
      </div>

      {/* Progress log */}
      {(isRunning || progressLines.length > 0) && (
        <div className="border-b border-cm-border-subtle shrink-0">
          <div className="flex items-center gap-2 px-4 py-2 bg-cm-bg-elevated/50">
            {isRunning
              ? <Loader2 className="h-3 w-3 animate-spin text-cm-node-harmonize shrink-0" />
              : <CheckCircle2 className="h-3 w-3 text-cm-success shrink-0" />}
            <span className="text-[11px] font-medium text-cm-text-secondary">
              {isRunning ? "Processing..." : "Completed"}
            </span>
          </div>
          <div className="max-h-[100px] overflow-auto px-4 py-2 bg-cm-bg-elevated/20">
            {progressLines.map((line, i) => (
              <p key={i} className="text-[10px] text-cm-text-tertiary font-mono leading-relaxed">{line}</p>
            ))}
            <div ref={progressEndRef} />
          </div>
        </div>
      )}

      {/* Content area */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-cm-accent" />
        </div>
      ) : tables.length === 0 && !isRunning ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Layers className="h-8 w-8 text-cm-node-harmonize/30" />
          <p className="text-sm text-cm-text-secondary">No harmonized tables yet</p>
          <p className="text-xs text-cm-text-tertiary">
            Run harmonization to merge source data into canonical tables.
          </p>
        </div>
      ) : tables.length > 0 ? (
        <>
          {/* Table tabs */}
          <div className="flex items-center border-b border-cm-border-primary shrink-0">
            <div className="flex flex-1 items-center gap-0 overflow-x-auto">
              {tables.map((t) => {
                const isActive = t.name === currentTab;
                return (
                  <button
                    key={t.name}
                    onClick={() => setActiveTab(t.name)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 whitespace-nowrap transition-colors",
                      isActive
                        ? "border-cm-node-harmonize text-cm-node-harmonize"
                        : "border-transparent text-cm-text-tertiary hover:text-cm-text-secondary",
                    )}
                  >
                    {formatTableName(t.name)}
                    <span className={cn(
                      "text-[9px] px-1 rounded-full",
                      isActive ? "bg-cm-node-harmonize/10 text-cm-node-harmonize" : "bg-cm-bg-elevated text-cm-text-tertiary",
                    )}>
                      {t.rows.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active table data */}
          {currentTable && (
            <TableDataGrid
              key={currentTable.name}
              projectId={projectId}
              table={currentTable}
            />
          )}
        </>
      ) : null}

      <div className="shrink-0 border-t border-cm-border-primary bg-cm-bg-surface px-3 py-2 text-[10px] text-cm-text-tertiary flex items-center gap-1">
        <Database className="h-3 w-3" />
        {coveredColumns} mapped columns · {tables.length} output tables
      </div>
    </div>
  );
}
