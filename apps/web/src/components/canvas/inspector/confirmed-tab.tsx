import { useState, useEffect, useCallback } from "react";
import { Check, Loader2 } from "lucide-react";
import { useActiveProject } from "@/hooks/use-active-project";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { fetchMappings } from "@/lib/api/mappings";

interface ConfirmedMapping {
  id: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  confidence: number;
}

export function ConfirmedTab() {
  const { projectId } = useActiveProject();
  const [confirmed, setConfirmed] = useState<ConfirmedMapping[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const pg = usePagination(total, { defaultPageSize: 20 });

  const load = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    fetchMappings(projectId, { page: pg.page, pageSize: pg.pageSize })
      .then((res) => {
        setConfirmed(
          res.data
            .filter((m) => m.status === "accepted")
            .map((m) => ({
              id: m.id,
              sourceColumn: m.source_column,
              targetTable: m.target_table,
              targetColumn: m.target_column,
              confidence: m.confidence,
            })),
        );
        setTotal(res.total);
      })
      .catch(() => { setConfirmed([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [projectId, pg.page, pg.pageSize]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center text-cm-text-tertiary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (confirmed.length === 0) {
    return (
      <p className="mt-3 text-sm text-cm-text-tertiary">
        No confirmed mappings yet.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-xs text-cm-text-secondary">
        {confirmed.length} mappings confirmed
      </p>
      <div className="space-y-1.5">
        {confirmed.map((mapping) => (
          <div
            key={mapping.id}
            className="flex items-center gap-2 rounded-md border border-cm-border-subtle bg-cm-success-subtle/30 px-2.5 py-2"
          >
            <Check className="h-3.5 w-3.5 shrink-0 text-cm-success" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-cm-text-primary font-mono truncate">
                {mapping.sourceColumn}
              </p>
              <p className="text-[10px] text-cm-text-tertiary">
                &rarr; {mapping.targetTable}.{mapping.targetColumn}
              </p>
            </div>
            <span className="text-[10px] text-cm-text-tertiary">
              {(mapping.confidence * 100).toFixed(0)}%
            </span>
          </div>
        ))}
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
        />
      )}
    </div>
  );
}
