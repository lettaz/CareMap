import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  MessageCircle,
  X,
  Layers,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Sparkles,
  Link2,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { EditableLabel } from "@/components/shared/editable-label";
import {
  fetchHarmonizedTables,
  fetchTablePreview,
  fetchTableRelationships,
  type HarmonizedTableDTO,
  type TablePreviewDTO,
  type TableJoinDTO,
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

function getJoinsForTable(tableName: string, joins: TableJoinDTO[]): Array<{ targetTable: string; column: string }> {
  const related: Array<{ targetTable: string; column: string }> = [];
  for (const j of joins) {
    if (j.fromTable === tableName) related.push({ targetTable: j.toTable, column: j.joinColumn });
    else if (j.toTable === tableName) related.push({ targetTable: j.fromTable, column: j.joinColumn });
  }
  return related;
}

function getFkColumnsForTable(tableName: string, joins: TableJoinDTO[]): Map<string, string[]> {
  const fkMap = new Map<string, string[]>();
  for (const j of joins) {
    if (j.fromTable === tableName) {
      const existing = fkMap.get(j.joinColumn) ?? [];
      existing.push(j.toTable);
      fkMap.set(j.joinColumn, existing);
    } else if (j.toTable === tableName) {
      const existing = fkMap.get(j.joinColumn) ?? [];
      existing.push(j.fromTable);
      fkMap.set(j.joinColumn, existing);
    }
  }
  return fkMap;
}

/* ── Table data grid with FK badges ── */

function TableDataGrid({
  projectId,
  table,
  joins,
  nodeId,
}: {
  projectId: string;
  table: HarmonizedTableDTO;
  joins: TableJoinDTO[];
  nodeId?: string;
}) {
  const [preview, setPreview] = useState<TablePreviewDTO | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(table.rows / PAGE_SIZE));
  const fkColumns = useMemo(() => getFkColumnsForTable(table.name, joins), [table.name, joins]);
  const relatedTables = useMemo(() => getJoinsForTable(table.name, joins), [table.name, joins]);

  const loadPage = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchTablePreview(projectId, table.name, PAGE_SIZE, p * PAGE_SIZE, nodeId);
        setPreview(data);
        setPage(p);
        gridRef.current?.scrollTo({ top: 0 });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    },
    [projectId, table.name, nodeId],
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

  const uniqueRelated = Array.from(
    new Map(relatedTables.map((r) => [`${r.targetTable}:${r.column}`, r])).values(),
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Relationship header */}
      {uniqueRelated.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-cm-border-subtle bg-cm-accent/[0.03] shrink-0 flex-wrap">
          <Link2 className="h-3 w-3 text-cm-accent shrink-0" />
          <span className="text-[10px] text-cm-text-tertiary">Joins to:</span>
          {uniqueRelated.map((r) => (
            <span
              key={`${r.targetTable}:${r.column}`}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-cm-accent bg-cm-accent/10 rounded-full px-2 py-0.5"
            >
              {formatTableName(r.targetTable)}
              <span className="text-cm-text-tertiary font-normal">via</span>
              <span className="font-mono text-[9px]">{r.column}</span>
            </span>
          ))}
        </div>
      )}

      {/* Column summary */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-cm-border-subtle bg-cm-bg-elevated/30 shrink-0">
        <CheckCircle2 className="h-3 w-3 text-cm-success shrink-0" />
        <span className="text-[10px] text-cm-text-secondary">
          {table.columns.length} columns · {table.rows.toLocaleString()} rows
        </span>
      </div>

      {/* Data grid */}
      <TooltipProvider>
        <div ref={gridRef} className="flex-1 overflow-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-cm-bg-elevated">
                <th className="px-2.5 py-2 text-left text-[10px] font-semibold text-cm-text-tertiary uppercase tracking-wider border-b border-cm-border-subtle w-[1%] whitespace-nowrap">
                  #
                </th>
                {preview.columns.map((col) => {
                  const fkTargets = fkColumns.get(col);
                  return (
                    <th
                      key={col}
                      className="px-2.5 py-2 text-left text-[10px] font-semibold text-cm-text-secondary uppercase tracking-wider whitespace-nowrap border-b border-cm-border-subtle"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col}
                        {fkTargets && (
                          <Tooltip>
                            <TooltipTrigger className="inline-flex">
                              <Link2 className="h-3 w-3 text-cm-accent" />
                            </TooltipTrigger>
                            <TooltipContent>
                              FK → {fkTargets.map((t) => `${t}.${col}`).join(", ")}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                    </th>
                  );
                })}
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
      </TooltipProvider>

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

/* ── ER Diagram Modal ── */

const TABLE_COLORS = [
  "border-cm-accent bg-cm-accent/5",
  "border-purple-500 bg-purple-500/5",
  "border-teal-500 bg-teal-500/5",
  "border-amber-500 bg-amber-500/5",
  "border-rose-500 bg-rose-500/5",
  "border-sky-500 bg-sky-500/5",
  "border-lime-500 bg-lime-500/5",
];

function ERDiagramModal({
  tables,
  joins,
}: {
  tables: HarmonizedTableDTO[];
  joins: TableJoinDTO[];
}) {
  const tableColorMap = useMemo(() => {
    const map = new Map<string, string>();
    tables.forEach((t, i) => map.set(t.name, TABLE_COLORS[i % TABLE_COLORS.length]!));
    return map;
  }, [tables]);

  const uniqueJoins = useMemo(() => {
    const seen = new Set<string>();
    return joins.filter((j) => {
      const key = [j.fromTable, j.toTable, j.joinColumn].sort().join("::");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [joins]);

  return (
    <Dialog>
      <DialogTrigger
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-medium text-cm-text-secondary hover:text-cm-text-primary bg-cm-bg-elevated hover:bg-cm-bg-elevated/80 border border-cm-border-subtle transition-colors"
      >
        <Network className="h-3 w-3" />
        Visualize
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entity Relationship Diagram</DialogTitle>
        </DialogHeader>

        {/* Table cards */}
        <div className="flex flex-wrap gap-3 mt-2">
          {tables.map((t) => {
            const fkCols = getFkColumnsForTable(t.name, joins);
            return (
              <div
                key={t.name}
                className={cn(
                  "rounded-lg border-2 overflow-hidden min-w-[160px] flex-1",
                  tableColorMap.get(t.name),
                )}
              >
                <div className="px-3 py-2 border-b border-current/10">
                  <p className="text-xs font-semibold text-cm-text-primary">{formatTableName(t.name)}</p>
                  <p className="text-[9px] text-cm-text-tertiary mt-0.5">{t.rows.toLocaleString()} rows</p>
                </div>
                <div className="px-3 py-1.5 space-y-0.5">
                  {t.columns.map((col) => {
                    const isFk = fkCols.has(col);
                    return (
                      <div key={col} className="flex items-center gap-1.5 py-0.5">
                        {isFk ? (
                          <Link2 className="h-2.5 w-2.5 text-cm-accent shrink-0" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-cm-text-tertiary/20 shrink-0" />
                        )}
                        <span className={cn(
                          "font-mono text-[10px]",
                          isFk ? "text-cm-accent font-medium" : "text-cm-text-secondary",
                        )}>
                          {col}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Relationships list */}
        {uniqueJoins.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-cm-text-secondary">Relationships</p>
            <div className="space-y-1.5">
              {uniqueJoins.map((j) => (
                <div
                  key={`${j.fromTable}:${j.toTable}:${j.joinColumn}`}
                  className="flex items-center gap-2 rounded-md border border-cm-border-subtle bg-cm-bg-elevated/50 px-3 py-2"
                >
                  <span className="text-[11px] font-medium text-cm-text-primary">{formatTableName(j.fromTable)}</span>
                  <span className="text-[10px] text-cm-text-tertiary">↔</span>
                  <span className="text-[11px] font-medium text-cm-text-primary">{formatTableName(j.toTable)}</span>
                  <span className="ml-auto font-mono text-[10px] text-cm-accent bg-cm-accent/10 rounded-full px-2 py-0.5">
                    {j.joinColumn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {uniqueJoins.length === 0 && (
          <p className="text-xs text-cm-text-tertiary italic mt-4">No relationships detected between tables.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Main panel ── */

export function HarmonizeDetailPanel({ nodeId }: HarmonizeDetailPanelProps) {
  const { projectId } = useActiveProject();
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined,
  );
  const selectNode = usePipelineStore((s) => s.selectNode);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const openPanel = useAgentStore((s) => s.openPanel);
  const setPendingMessage = useAgentStore((s) => s.setPendingMessage);

  const [tables, setTables] = useState<HarmonizedTableDTO[]>([]);
  const [joins, setJoins] = useState<TableJoinDTO[]>([]);
  const [acceptedMappings, setAcceptedMappings] = useState<FieldMappingDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const acceptedMappingIds = acceptedMappings.map((m) => m.id);
  const coveredColumns = new Set(acceptedMappings.map((m) => `${m.target_table}.${m.target_column}`)).size;

  const loadData = useCallback(async () => {
    if (!projectId) return { tables: [] as HarmonizedTableDTO[], ids: [] as string[] };
    try {
      const [harmonized, mappings, relationships] = await Promise.all([
        fetchHarmonizedTables(projectId, nodeId),
        fetchMappings(projectId, { page: 1, pageSize: 500 }),
        fetchTableRelationships(projectId, nodeId),
      ]);
      const freshTables = harmonized.tables ?? [];
      const accepted = mappings.data.filter((m) => m.status === "accepted");
      setTables(freshTables);
      setAcceptedMappings(accepted);
      setJoins(relationships.joins ?? []);
      return { tables: freshTables, ids: accepted.map((m) => m.id) };
    } catch {
      return { tables: [] as HarmonizedTableDTO[], ids: [] as string[] };
    }
  }, [projectId, nodeId]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const isRunning = node?.data.status === "running";
  const prevRunningRef = useRef(isRunning);

  useEffect(() => {
    if (prevRunningRef.current && !isRunning) {
      loadData();
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, loadData]);

  const handleRun = useCallback(() => {
    if (!projectId || acceptedMappingIds.length === 0) return;
    updateNodeData(projectId, nodeId, { status: "running" });
    selectNode(projectId, null);
    setPendingMessage({
      text: "Generate an intelligent harmonization script for the accepted mappings, then execute it after I review.",
      mentions: [{
        label: node?.data.label ?? "Harmonize",
        id: nodeId,
        category: "harmonize",
      }],
      transformNodeId: nodeId,
    });
    openPanel();
  }, [projectId, nodeId, node?.data.label, acceptedMappingIds.length, updateNodeData, selectNode, setPendingMessage, openPanel]);

  const handleViewChat = useCallback(() => {
    if (!projectId) return;
    selectNode(projectId, null);
    openPanel();
  }, [projectId, selectNode, openPanel]);

  if (!node || !projectId) return null;

  const totalRows = tables.reduce((sum, t) => sum + t.rows, 0);
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
          {tables.length > 0 && (
            <ERDiagramModal tables={tables} joins={joins} />
          )}
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
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
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
            {coveredColumns} mapped column{coveredColumns !== 1 ? "s" : ""} ready for harmonization.
          </p>
        )}
      </div>

      {/* Running banner */}
      {isRunning && (
        <div className="flex items-center gap-2.5 border-b border-cm-node-harmonize/20 bg-cm-node-harmonize-subtle px-4 py-2.5 shrink-0">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-cm-node-harmonize shrink-0" />
          <p className="text-[11px] text-cm-node-harmonize font-medium flex-1">
            AI is generating and executing the harmonization script...
          </p>
          <button
            onClick={handleViewChat}
            className="text-[10px] font-medium text-cm-node-harmonize underline underline-offset-2 shrink-0"
          >
            View in Chat
          </button>
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
              joins={joins}
              nodeId={nodeId}
            />
          )}
        </>
      ) : null}

      <div className="shrink-0 border-t border-cm-border-primary bg-cm-bg-surface px-3 py-2 text-[10px] text-cm-text-tertiary flex items-center gap-1">
        <Database className="h-3 w-3" />
        {coveredColumns} mapped columns · {tables.length} output tables
        {joins.length > 0 && (
          <span className="ml-auto flex items-center gap-1">
            <Link2 className="h-2.5 w-2.5" />
            {joins.length} relationship{joins.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
