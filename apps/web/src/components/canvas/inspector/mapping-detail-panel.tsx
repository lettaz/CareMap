import { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  X,
  Check,
  XCircle,
  AlertTriangle,
  Sparkles,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { EditableLabel } from "@/components/shared/editable-label";
import {
  fetchMappings,
  updateMapping,
  bulkAcceptMappings,
  type FieldMappingDTO,
} from "@/lib/api/mappings";
import { fetchActiveSchema, type TargetSchemaDTO } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";

interface MappingDetailPanelProps {
  nodeId: string;
}

export function MappingDetailPanel({ nodeId }: MappingDetailPanelProps) {
  const { projectId } = useActiveProject();
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined,
  );
  const selectNode = usePipelineStore((s) => s.selectNode);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const [mappings, setMappings] = useState<FieldMappingDTO[]>([]);
  const [schema, setSchema] = useState<TargetSchemaDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([fetchMappings(projectId, { page: 1, pageSize: 100 }), fetchActiveSchema(projectId)])
      .then(([res, s]) => {
        setMappings(res.data);
        setSchema(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleAccept = useCallback(
    async (id: string) => {
      const updated = await updateMapping(id, { status: "accepted" });
      setMappings((prev) => prev.map((m) => (m.id === id ? updated : m)));
    },
    [],
  );

  const handleReject = useCallback(
    async (id: string) => {
      const updated = await updateMapping(id, { status: "rejected" });
      setMappings((prev) => prev.map((m) => (m.id === id ? updated : m)));
    },
    [],
  );

  const handleBulkAccept = useCallback(async () => {
    if (!projectId) return;
    setBulkLoading(true);
    try {
      const { accepted } = await bulkAcceptMappings(projectId);
      if (accepted > 0) {
        const res = await fetchMappings(projectId, { page: 1, pageSize: 100 });
        setMappings(res.data);
      }
    } finally {
      setBulkLoading(false);
    }
  }, [projectId]);

  if (!node || !projectId) return null;

  const accepted = mappings.filter((m) => m.status === "accepted").length;
  const rejected = mappings.filter((m) => m.status === "rejected").length;
  const pending = mappings.filter((m) => m.status === "pending").length;
  const total = mappings.length;

  const tableGroups = new Map<string, FieldMappingDTO[]>();
  for (const m of mappings) {
    const group = tableGroups.get(m.target_table) ?? [];
    group.push(m);
    tableGroups.set(m.target_table, group);
  }

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
            {total} mappings · {accepted} accepted · {pending} pending
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => selectNode(projectId, null)} title="Back to Chat">
            <MessageCircle className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => selectNode(projectId, null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-cm-border-primary px-4 py-2.5 shrink-0 flex-wrap">
        <StatBadge icon={Check} color="text-cm-success" bg="bg-cm-success-subtle" count={accepted} label="accepted" />
        {pending > 0 && (
          <StatBadge icon={AlertTriangle} color="text-cm-warning" bg="bg-cm-warning-subtle" count={pending} label="pending" />
        )}
        {rejected > 0 && (
          <StatBadge icon={XCircle} color="text-cm-error" bg="bg-cm-error-subtle" count={rejected} label="rejected" />
        )}
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

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-cm-accent" />
        </div>
      ) : mappings.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Sparkles className="h-8 w-8 text-cm-accent/30" />
          <p className="text-sm text-cm-text-secondary">No mappings yet</p>
          <p className="text-xs text-cm-text-tertiary">
            Connect source nodes and the AI agent will propose mappings.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {[...tableGroups.entries()].map(([table, items]) => (
            <div key={table}>
              <div className="sticky top-0 z-10 bg-cm-bg-elevated px-4 py-2 border-b border-cm-border-subtle">
                <span className="font-mono text-[11px] font-medium text-cm-text-primary">{table}</span>
                <span className="text-[10px] text-cm-text-tertiary ml-2">{items.length} fields</span>
              </div>
              {items.map((m) => (
                <MappingRow
                  key={m.id}
                  mapping={m}
                  onAccept={() => handleAccept(m.id)}
                  onReject={() => handleReject(m.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {schema && (
        <div className="shrink-0 border-t border-cm-border-primary bg-cm-bg-surface px-3 py-2 text-[10px] text-cm-text-tertiary">
          Schema: v{schema.version} ({schema.status}) · {schema.tables.length} tables
        </div>
      )}
    </div>
  );
}

function MappingRow({
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
          <span className="font-mono text-[11px] text-cm-text-secondary truncate">
            {mapping.source_column}
          </span>
          <span className="text-cm-text-tertiary text-[10px]">→</span>
          <span className="font-mono text-[11px] font-medium text-cm-text-primary truncate">
            {mapping.target_column}
          </span>
        </div>
        {mapping.reasoning && (
          <p className="text-[10px] text-cm-text-tertiary truncate mt-0.5">{mapping.reasoning}</p>
        )}
      </div>

      <span className={cn(
        "text-[10px] font-medium tabular-nums shrink-0",
        confidencePct >= 80 ? "text-cm-success" : confidencePct >= 60 ? "text-cm-warning" : "text-cm-error",
      )}>
        {confidencePct}%
      </span>

      {mapping.status === "pending" ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onAccept}
            className="flex h-6 w-6 items-center justify-center rounded bg-cm-success-subtle text-cm-success hover:bg-cm-success/20 transition-colors"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            onClick={onReject}
            className="flex h-6 w-6 items-center justify-center rounded bg-cm-error-subtle text-cm-error hover:bg-cm-error/20 transition-colors"
          >
            <XCircle className="h-3 w-3" />
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
