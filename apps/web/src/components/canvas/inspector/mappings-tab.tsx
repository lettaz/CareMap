import { useState, useEffect, useCallback } from "react";
import { Check, X, HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { usePagination } from "@/hooks/use-pagination";
import { useActiveProject } from "@/hooks/use-active-project";
import { fetchMappings, updateMapping, type FieldMappingDTO } from "@/lib/api/mappings";
import type { FieldMapping, MappingStatus } from "@/lib/types";

interface MappingsTabProps {
  sourceFileId?: string;
}

function dtoToMapping(dto: FieldMappingDTO): FieldMapping {
  return {
    id: dto.id,
    sourceFileId: dto.source_file_id,
    sourceColumn: dto.source_column,
    targetTable: dto.target_table,
    targetColumn: dto.target_column,
    confidence: dto.confidence,
    reasoning: dto.reasoning,
    status: dto.status,
    transformation: dto.transformation ?? undefined,
    sampleValue: dto.sample_value ?? undefined,
  };
}

const STATUS_CONFIG: Record<MappingStatus, { icon: typeof Check; className: string }> = {
  accepted: { icon: Check, className: "text-cm-success" },
  rejected: { icon: X, className: "text-cm-error" },
  pending: { icon: HelpCircle, className: "text-cm-warning" },
};

export function MappingsTab({ sourceFileId }: MappingsTabProps) {
  const { projectId } = useActiveProject();
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const pg = usePagination(total, { defaultPageSize: 10 });

  const loadMappings = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    fetchMappings(projectId, { page: pg.page, pageSize: pg.pageSize })
      .then((res) => {
        let mapped = res.data.map(dtoToMapping);
        if (sourceFileId) {
          mapped = mapped.filter((m) => m.sourceFileId === sourceFileId);
        }
        setMappings(mapped);
        setTotal(res.total);
      })
      .catch(() => { setMappings([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [projectId, sourceFileId, pg.page, pg.pageSize]);

  useEffect(() => { loadMappings(); }, [loadMappings]);

  const handleStatus = async (id: string, status: MappingStatus) => {
    setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    try {
      await updateMapping(id, { status });
      toast.success(`Mapping ${status}`);
    } catch {
      setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, status: "pending" } : m)));
      toast.error("Failed to update mapping");
    }
  };

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center text-cm-text-tertiary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (mappings.length === 0) {
    return (
      <p className="mt-3 text-sm text-cm-text-tertiary">
        No mapping suggestions yet. Run the Builder Agent to generate mappings.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col">
      <div className="space-y-2">
        {mappings.map((mapping) => {
          const { icon: StatusIcon, className: statusClass } = STATUS_CONFIG[mapping.status];
          return (
            <div
              key={mapping.id}
              className="rounded-md border border-cm-border-primary bg-cm-bg-surface p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-cm-text-primary font-mono truncate">
                    {mapping.sourceColumn}
                  </p>
                  <p className="text-[10px] text-cm-text-tertiary">
                    &rarr; {mapping.targetTable}.{mapping.targetColumn}
                  </p>
                </div>
                <StatusIcon className={`h-4 w-4 shrink-0 ${statusClass}`} />
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                <ConfidenceBar value={mapping.confidence} />
                <span className="text-xs text-cm-text-tertiary">
                  {(mapping.confidence * 100).toFixed(0)}%
                </span>
              </div>

              <p className="mt-1 text-[10px] text-cm-text-secondary leading-relaxed">
                {mapping.reasoning}
              </p>

              {mapping.status === "pending" && (
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => handleStatus(mapping.id, "accepted")}
                    className="flex items-center gap-1 rounded bg-cm-success-subtle px-2 py-1 text-[10px] font-medium text-cm-success hover:bg-cm-success/10 transition-colors"
                  >
                    <Check className="h-3 w-3" /> Accept
                  </button>
                  <button
                    onClick={() => handleStatus(mapping.id, "rejected")}
                    className="flex items-center gap-1 rounded bg-cm-error-subtle px-2 py-1 text-[10px] font-medium text-cm-error hover:bg-cm-error/10 transition-colors"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {total > pg.pageSize && (
        <PaginationBar
          page={pg.page}
          totalPages={pg.totalPages}
          total={total}
          pageSize={pg.pageSize}
          hasNext={pg.hasNext}
          hasPrev={pg.hasPrev}
          onNext={pg.nextPage}
          onPrev={pg.prevPage}
          compact
          className="mt-2"
        />
      )}
    </div>
  );
}
