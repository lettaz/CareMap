import { useState, useEffect } from "react";
import { Database, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useActiveProject } from "@/hooks/use-active-project";
import { fetchHarmonizedTables, type HarmonizedTableDTO } from "@/lib/api/harmonize";
import { fetchMappings, type FieldMappingDTO } from "@/lib/api/mappings";
import { fetchProjectSources } from "@/lib/api/projects";

export function StoreStatusTab() {
  const { projectId } = useActiveProject();
  const [tables, setTables] = useState<HarmonizedTableDTO[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [sourceCount, setSourceCount] = useState(0);
  const [acceptedMappings, setAcceptedMappings] = useState(0);
  const [totalMappings, setTotalMappings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);

    Promise.all([
      fetchHarmonizedTables(projectId).catch(() => ({ tables: [] })),
      fetchMappings(projectId, { page: 1, pageSize: 500 }).catch(() => ({ data: [] as FieldMappingDTO[], total: 0, page: 1, pageSize: 500 })),
      fetchProjectSources(projectId).catch(() => []),
    ]).then(([harmonized, mappingsRes, sources]) => {
      setTables(harmonized.tables);
      setTotalRows(sources.reduce((acc, s) => acc + (s.row_count ?? 0), 0));
      setSourceCount(sources.length);
      const mappingsList = mappingsRes.data;
      setTotalMappings(mappingsList.length);
      setAcceptedMappings(mappingsList.filter((m: FieldMappingDTO) => m.status === "accepted").length);
      setLoading(false);
    });
  }, [projectId]);

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center text-cm-text-tertiary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cm-node-sink-subtle">
          <Database className="h-5 w-5 text-cm-node-sink" />
        </div>
        <div>
          <p className="text-sm font-medium text-cm-text-primary">Harmonized Store</p>
          <p className="text-xs text-cm-text-tertiary">Supabase Storage / DuckDB</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md bg-cm-bg-elevated px-3 py-2">
          <span className="text-xs text-cm-text-secondary">Total Rows</span>
          <span className="text-xs font-medium text-cm-text-primary">{totalRows.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-cm-bg-elevated px-3 py-2">
          <span className="text-xs text-cm-text-secondary">Sources Ingested</span>
          <span className="text-xs font-medium text-cm-text-primary">{sourceCount}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-cm-bg-elevated px-3 py-2">
          <span className="text-xs text-cm-text-secondary">Mappings Applied</span>
          <span className="text-xs font-medium text-cm-text-primary">
            {acceptedMappings} / {totalMappings}
          </span>
        </div>
      </div>

      {tables.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-cm-text-secondary">Tables</p>
          {tables.map((t) => (
            <div key={t.name} className="flex items-center gap-2 rounded-md border border-cm-border-primary px-3 py-2">
              <Check className="h-3.5 w-3.5 text-cm-success" />
              <span className="text-xs text-cm-text-primary">{t.name}</span>
              <span className="ml-auto text-[10px] text-cm-text-tertiary">{t.rows} rows</span>
            </div>
          ))}
        </div>
      )}

      {tables.length === 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-cm-text-secondary">Tables</p>
          <div className="flex items-center gap-2 rounded-md border border-dashed border-cm-border-primary px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-cm-warning" />
            <span className="text-xs text-cm-text-tertiary">No harmonized tables yet</span>
          </div>
        </div>
      )}
    </div>
  );
}
