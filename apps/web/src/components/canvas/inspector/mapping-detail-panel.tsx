import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  MessageCircle,
  X,
  Check,
  XCircle,
  AlertTriangle,
  Sparkles,
  Loader2,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  GitMerge,
  CircleDot,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import type { PipelineNodeData } from "@/lib/types";
import { EditableLabel } from "@/components/shared/editable-label";
import {
  fetchMappings,
  updateMapping,
  bulkAcceptMappings,
  type FieldMappingDTO,
} from "@/lib/api/mappings";
import { fetchActiveSchema, activateSchema, type TargetSchemaDTO, type SchemaTableDTO } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";

interface MappingDetailPanelProps {
  nodeId: string;
}

export function MappingDetailPanel({ nodeId }: MappingDetailPanelProps) {
  const { projectId } = useActiveProject();
  const pipeline = usePipelineStore((s) => projectId ? s.pipelines[projectId] : null);
  const node = pipeline?.nodes.find((n) => n.id === nodeId);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const openPanel = useAgentStore((s) => s.openPanel);
  const setPendingMessage = useAgentStore((s) => s.setPendingMessage);

  const connectedSourceFileIds = useMemo(() => {
    if (!pipeline) return new Set<string>();
    const incomingEdges = pipeline.edges.filter((e) => e.target === nodeId);
    const ids = new Set<string>();
    for (const edge of incomingEdges) {
      const srcNode = pipeline.nodes.find((n) => n.id === edge.source);
      if (srcNode?.data.category === "source" && srcNode.data.sourceFileId) {
        ids.add(srcNode.data.sourceFileId as string);
      }
    }
    return ids;
  }, [pipeline, nodeId]);

  const connectedSourceNodes = useMemo(() => {
    if (!pipeline) return [];
    const incomingEdges = pipeline.edges.filter((e) => e.target === nodeId);
    return incomingEdges
      .map((e) => pipeline.nodes.find((n) => n.id === e.source))
      .filter((n) => n?.data.category === "source" && n.data.sourceFileId)
      .map((n) => n!);
  }, [pipeline, nodeId]);

  const connectedSourceFileIdsRef = useRef(connectedSourceFileIds);
  connectedSourceFileIdsRef.current = connectedSourceFileIds;

  const [allMappings, setAllMappings] = useState<FieldMappingDTO[]>([]);
  const [schema, setSchema] = useState<TargetSchemaDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const wasRunningRef = useRef(false);

  const isRunning = node?.data.status === "running";

  const hasIncomingEdges = pipeline?.edges.some((e) => e.target === nodeId) ?? false;

  const mappings = useMemo(() => {
    if (connectedSourceFileIds.size === 0) {
      return hasIncomingEdges ? [] : allMappings;
    }
    return allMappings.filter(
      (m) => !m.source_file_id || connectedSourceFileIds.has(m.source_file_id),
    );
  }, [allMappings, connectedSourceFileIds, hasIncomingEdges]);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [res, s] = await Promise.all([
        fetchMappings(projectId, { page: 1, pageSize: 200 }),
        fetchActiveSchema(projectId),
      ]);
      setAllMappings(res.data);
      setSchema(s);
    } catch { /* silent */ }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const csfi = connectedSourceFileIdsRef.current;
    const scopedMappings = csfi.size > 0
      ? allMappings.filter((m) => !m.source_file_id || csfi.has(m.source_file_id))
      : allMappings;
    const totalFields = schema?.tables?.reduce((sum, t) => sum + t.columns.length, 0) ?? 0;
    const acceptedCount = scopedMappings.filter((m) => m.status === "accepted").length;
    updateNodeData(projectId, nodeId, {
      schemaStatus: (schema?.status as PipelineNodeData["schemaStatus"]) ?? undefined,
      schemaTableCount: schema?.tables?.length ?? 0,
      totalFields,
      mappedCount: acceptedCount,
      sourceCount: csfi.size || undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, allMappings, projectId, nodeId]);

  useEffect(() => {
    if (schema?.tables?.length && !activeTab) {
      setActiveTab(schema.tables[0].name);
    }
  }, [schema, activeTab]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData, nodeId]);

  useEffect(() => {
    if (isRunning) {
      wasRunningRef.current = true;
      pollRef.current = setInterval(loadData, 4000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
    if (pollRef.current) clearInterval(pollRef.current);
    if (wasRunningRef.current) {
      wasRunningRef.current = false;
      loadData();
    }
  }, [isRunning, loadData]);

  const handleAccept = useCallback(async (id: string) => {
    const updated = await updateMapping(id, { status: "accepted" });
    setAllMappings((prev) => prev.map((m) => (m.id === id ? updated : m)));
  }, []);

  const handleReject = useCallback(async (id: string) => {
    const updated = await updateMapping(id, { status: "rejected" });
    setAllMappings((prev) => prev.map((m) => (m.id === id ? updated : m)));
  }, []);

  const handleBulkAccept = useCallback(async () => {
    if (!projectId) return;
    setBulkLoading(true);
    try {
      const { accepted } = await bulkAcceptMappings(projectId);
      if (accepted > 0) await loadData();
    } finally {
      setBulkLoading(false);
    }
  }, [projectId, loadData]);

  const handleActivateSchema = useCallback(async () => {
    if (!projectId || !schema) return;
    setActivating(true);
    try {
      const activated = await activateSchema(projectId, schema.id);
      setSchema(activated);
      updateNodeData(projectId, nodeId, {
        schemaStatus: activated.status as PipelineNodeData["schemaStatus"],
        status: "running",
      });

      if (connectedSourceNodes.length > 0) {
        setPendingMessage({
          text: "The target schema has been activated. Now generate field mappings for the connected sources",
          mentions: connectedSourceNodes.map((n) => ({
            label: n.data.label,
            id: n.id,
            sourceFileId: n.data.sourceFileId as string,
            category: "source" as const,
          })),
          transformNodeId: nodeId,
        });
      }
    } catch { /* silent */ }
    setActivating(false);
  }, [projectId, schema, nodeId, updateNodeData, connectedSourceNodes, setPendingMessage]);

  const handleViewChat = useCallback(() => {
    if (!projectId) return;
    selectNode(projectId, null);
    openPanel();
  }, [projectId, selectNode, openPanel]);

  if (!node || !projectId) return null;

  const accepted = mappings.filter((m) => m.status === "accepted").length;
  const rejected = mappings.filter((m) => m.status === "rejected").length;
  const pending = mappings.filter((m) => m.status === "pending").length;
  const derived = mappings.filter((m) => m.source_column === "__derived__" || !m.source_file_id).length;
  const mapped = accepted - derived;

  const tableGroups = new Map<string, FieldMappingDTO[]>();
  for (const m of mappings) {
    const group = tableGroups.get(m.target_table) ?? [];
    group.push(m);
    tableGroups.set(m.target_table, group);
  }

  const schemaTables = schema?.tables ?? [];
  const tabList = schemaTables.length > 0
    ? schemaTables
    : [...tableGroups.keys()].map((name) => ({ name, columns: [], description: undefined }) as SchemaTableDTO);

  const currentTab = activeTab ?? tabList[0]?.name;
  const currentSchemaTable = schemaTables.find((t) => t.name === currentTab);
  const currentMappings = tableGroups.get(currentTab ?? "") ?? [];

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
            {schemaTables.length} target tables · {mappings.length} columns · {pending} need attention
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

      {/* Stat badges */}
      <div className="flex items-center gap-2 border-b border-cm-border-primary px-4 py-2 shrink-0 flex-wrap">
        {mapped > 0 && <StatBadge icon={Check} color="text-cm-success" bg="bg-cm-success-subtle" count={mapped} label="mapped" />}
        {derived > 0 && <StatBadge icon={GitMerge} color="text-purple-600" bg="bg-purple-50" count={derived} label="derived" />}
        {pending > 0 && <StatBadge icon={AlertTriangle} color="text-cm-warning" bg="bg-cm-warning-subtle" count={pending} label="review" />}
        {rejected > 0 && <StatBadge icon={XCircle} color="text-cm-error" bg="bg-cm-error-subtle" count={rejected} label="gaps" />}
        {pending > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-6 text-[10px]"
            onClick={handleBulkAccept}
            disabled={bulkLoading}
          >
            {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCheck className="h-3 w-3 mr-1" />}
            Auto-accept high confidence
          </Button>
        )}
      </div>

      {/* Running banner */}
      {isRunning && (
        <div className="flex items-center gap-2.5 border-b border-cm-accent/20 bg-cm-accent-subtle px-4 py-2.5 shrink-0">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-cm-accent shrink-0" />
          <p className="text-[11px] text-cm-accent font-medium flex-1">
            CareMap AI is proposing schema & mappings...
          </p>
          <button
            onClick={handleViewChat}
            className="text-[10px] font-medium text-cm-accent underline underline-offset-2 hover:text-cm-accent-hover shrink-0"
          >
            View in Chat
          </button>
        </div>
      )}

      {/* Schema activation gate */}
      {schema && schema.status === "draft" && (
        <div className="flex items-center gap-2.5 border-b border-cm-node-transform/20 bg-cm-node-transform-subtle px-4 py-2.5 shrink-0">
          <AlertTriangle className="h-3.5 w-3.5 text-cm-node-transform shrink-0" />
          <p className="text-[11px] text-cm-node-transform font-medium flex-1">
            Schema v{schema.version} is a draft. Activate it to enable field mapping.
          </p>
          <Button
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={handleActivateSchema}
            disabled={activating}
          >
            {activating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Activate
          </Button>
        </div>
      )}

      {loading && !schema ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-cm-accent" />
        </div>
      ) : !schema && mappings.length === 0 && !isRunning ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Sparkles className="h-8 w-8 text-cm-accent/30" />
          <p className="text-sm text-cm-text-secondary">No mappings yet</p>
          <p className="text-xs text-cm-text-tertiary">
            Connect source nodes and the AI agent will propose mappings.
          </p>
        </div>
      ) : (
        <>
          {/* Table tabs */}
          <div className="flex items-center gap-0 border-b border-cm-border-primary shrink-0 overflow-x-auto">
            {tabList.map((table) => {
              const count = tableGroups.get(table.name)?.length ?? 0;
              const isActive = table.name === currentTab;
              return (
                <button
                  key={table.name}
                  onClick={() => setActiveTab(table.name)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 whitespace-nowrap transition-colors",
                    isActive
                      ? "border-cm-accent text-cm-accent"
                      : "border-transparent text-cm-text-tertiary hover:text-cm-text-secondary",
                  )}
                >
                  {formatTableName(table.name)}
                  {count > 0 && (
                    <span className={cn(
                      "text-[9px] px-1 rounded-full",
                      isActive ? "bg-cm-accent/10 text-cm-accent" : "bg-cm-bg-elevated text-cm-text-tertiary",
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Table content */}
          <div className="flex-1 overflow-auto">
            {currentSchemaTable && (
              <div className="px-4 py-2.5 border-b border-cm-border-subtle flex items-center gap-2">
                <CircleDot className="h-3.5 w-3.5 text-cm-text-tertiary shrink-0" />
                <span className="font-mono text-xs font-medium text-cm-text-primary">{currentSchemaTable.name}</span>
                {currentSchemaTable.description && (
                  <span className="text-[10px] text-cm-text-tertiary truncate">
                    — {currentSchemaTable.description}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-cm-text-tertiary shrink-0">
                  {currentMappings.filter((m) => m.status === "accepted").length}/{currentSchemaTable.columns.length} covered
                </span>
              </div>
            )}

            {currentSchemaTable?.columns.map((schemaCol) => {
              const mapping = currentMappings.find((m) => m.target_column === schemaCol.name);
              return (
                <SchemaColumnRow
                  key={schemaCol.name}
                  schemaCol={schemaCol}
                  mapping={mapping}
                  onAccept={mapping ? () => handleAccept(mapping.id) : undefined}
                  onReject={mapping ? () => handleReject(mapping.id) : undefined}
                />
              );
            })}

            {!currentSchemaTable && currentMappings.map((m) => (
              <LegacyMappingRow
                key={m.id}
                mapping={m}
                onAccept={() => handleAccept(m.id)}
                onReject={() => handleReject(m.id)}
              />
            ))}
          </div>
        </>
      )}

      {schema && (
        <div className="shrink-0 border-t border-cm-border-primary bg-cm-bg-surface px-3 py-2 flex items-center gap-2 text-[10px] text-cm-text-tertiary">
          <Link2 className="h-3 w-3 shrink-0" />
          Schema v{schema.version} ({schema.status}) · {schema.tables.length} tables
        </div>
      )}
    </div>
  );
}

function SchemaColumnRow({
  schemaCol,
  mapping,
  onAccept,
  onReject,
}: {
  schemaCol: { name: string; type: string; description?: string; required?: boolean };
  mapping?: FieldMappingDTO;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDerived = mapping && (!mapping.source_file_id || mapping.source_column === "__derived__");
  const isMapped = mapping && mapping.status === "accepted" && !isDerived;
  const isPending = mapping?.status === "pending";
  const isGap = !mapping;

  const confidencePct = mapping ? Math.round(mapping.confidence * 100) : 0;

  return (
    <div className="border-b border-cm-border-subtle">
      <button
        type="button"
        onClick={() => mapping && setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors",
          mapping ? "hover:bg-cm-bg-elevated/50 cursor-pointer" : "cursor-default",
        )}
      >
        {mapping ? (
          expanded ? <ChevronDown className="h-3 w-3 text-cm-text-tertiary shrink-0" /> : <ChevronRight className="h-3 w-3 text-cm-text-tertiary shrink-0" />
        ) : (
          <div className="w-3" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-medium text-cm-text-primary">{schemaCol.name}</span>
            {schemaCol.required && (
              <span className="text-[8px] font-bold text-cm-accent uppercase px-1 py-px rounded bg-cm-accent/10">REQ</span>
            )}
            <span className="text-[10px] text-cm-text-tertiary font-mono">{schemaCol.type}</span>
          </div>
          {schemaCol.description && (
            <p className="text-[10px] text-cm-text-tertiary mt-0.5 truncate">{schemaCol.description}</p>
          )}
        </div>

        {mapping && (
          <div className="flex items-center gap-2 shrink-0">
            {isMapped && (
              <>
                <span className="text-[10px] text-cm-text-secondary">← {mapping.source_column}</span>
                <span className="text-[9px] font-medium text-cm-success flex items-center gap-0.5">
                  <Check className="h-2.5 w-2.5" /> Mapped
                </span>
              </>
            )}
            {isDerived && (
              <span className="text-[9px] font-medium text-purple-600 flex items-center gap-0.5">
                auto <GitMerge className="h-2.5 w-2.5" /> Derived
              </span>
            )}
            {isPending && (
              <>
                <span className="text-[10px] text-cm-text-secondary">← {mapping.source_column}</span>
                <span className={cn(
                  "text-[10px] font-medium tabular-nums",
                  confidencePct >= 80 ? "text-cm-success" : confidencePct >= 60 ? "text-cm-warning" : "text-cm-error",
                )}>
                  {confidencePct}%
                </span>
                {onAccept && onReject && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={onAccept} className="flex h-5 w-5 items-center justify-center rounded bg-cm-success-subtle text-cm-success hover:bg-cm-success/20 transition-colors">
                      <Check className="h-2.5 w-2.5" />
                    </button>
                    <button onClick={onReject} className="flex h-5 w-5 items-center justify-center rounded bg-cm-error-subtle text-cm-error hover:bg-cm-error/20 transition-colors">
                      <XCircle className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </>
            )}
            {mapping.status === "rejected" && (
              <span className="text-[9px] font-medium text-cm-error px-1.5 py-0.5 rounded-full bg-cm-error-subtle">
                rejected
              </span>
            )}
          </div>
        )}

        {isGap && (
          <span className="text-[9px] text-cm-text-tertiary italic shrink-0">unmapped</span>
        )}
      </button>

      {expanded && mapping && (
        <div className="bg-cm-bg-elevated/40 px-4 pb-3 pt-1 ml-7 space-y-1.5">
          {mapping.source_column && mapping.source_column !== "__derived__" && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-cm-text-tertiary font-mono">{mapping.source_column}</span>
              {mapping.sample_value && (
                <span className="text-cm-text-tertiary">Sample: {mapping.sample_value}</span>
              )}
              <span className={cn(
                "ml-auto font-medium tabular-nums",
                confidencePct >= 80 ? "text-cm-success" : confidencePct >= 60 ? "text-cm-warning" : "text-cm-error",
              )}>
                {confidencePct}%
              </span>
            </div>
          )}
          {mapping.reasoning && (
            <p className="text-[10px] text-cm-text-secondary flex items-start gap-1.5">
              <Sparkles className="h-3 w-3 text-cm-accent shrink-0 mt-0.5" />
              {mapping.reasoning}
            </p>
          )}
          {mapping.transformation && (
            <div className="rounded-md border border-cm-border-subtle bg-cm-bg-surface p-2">
              <p className="text-[9px] text-cm-text-tertiary font-medium uppercase tracking-wide mb-1">Transform</p>
              <pre className="text-[10px] font-mono text-cm-text-primary whitespace-pre-wrap">{mapping.transformation}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LegacyMappingRow({
  mapping,
  onAccept,
  onReject,
}: {
  mapping: FieldMappingDTO;
  onAccept: () => void;
  onReject: () => void;
}) {
  const confidencePct = Math.round(mapping.confidence * 100);

  return (
    <div className="flex items-center gap-2 border-b border-cm-border-subtle px-4 py-2 hover:bg-cm-bg-elevated/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-cm-text-secondary truncate">{mapping.source_column}</span>
          <span className="text-cm-text-tertiary text-[10px]">→</span>
          <span className="font-mono text-[11px] font-medium text-cm-text-primary truncate">{mapping.target_column}</span>
        </div>
      </div>
      <span className={cn(
        "text-[10px] font-medium tabular-nums shrink-0",
        confidencePct >= 80 ? "text-cm-success" : confidencePct >= 60 ? "text-cm-warning" : "text-cm-error",
      )}>
        {confidencePct}%
      </span>
      {mapping.status === "pending" ? (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onAccept} className="flex h-5 w-5 items-center justify-center rounded bg-cm-success-subtle text-cm-success hover:bg-cm-success/20 transition-colors">
            <Check className="h-2.5 w-2.5" />
          </button>
          <button onClick={onReject} className="flex h-5 w-5 items-center justify-center rounded bg-cm-error-subtle text-cm-error hover:bg-cm-error/20 transition-colors">
            <XCircle className="h-2.5 w-2.5" />
          </button>
        </div>
      ) : (
        <span className={cn(
          "text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
          mapping.status === "accepted" ? "bg-cm-success-subtle text-cm-success" : "bg-cm-error-subtle text-cm-error",
        )}>
          {mapping.status}
        </span>
      )}
    </div>
  );
}

function StatBadge({
  icon: Icon,
  color,
  bg,
  count,
  label,
}: {
  icon: typeof Check;
  color: string;
  bg: string;
  count: number;
  label: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", bg, color)}>
      <Icon className="h-2.5 w-2.5" /> {count} {label}
    </span>
  );
}

function formatTableName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
