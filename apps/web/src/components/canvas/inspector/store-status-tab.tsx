import { Database, Check, AlertTriangle } from "lucide-react";
import { MOCK_SOURCES } from "@/lib/mock-data";
import { MOCK_MAPPINGS } from "@/lib/mock-data";

export function StoreStatusTab() {
  const totalRows = MOCK_SOURCES.reduce((acc, s) => acc + s.rowCount, 0);
  const acceptedMappings = MOCK_MAPPINGS.filter((m) => m.status === "accepted").length;
  const totalMappings = MOCK_MAPPINGS.length;

  return (
    <div className="mt-3 space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cm-node-sink-subtle">
          <Database className="h-5 w-5 text-cm-node-sink" />
        </div>
        <div>
          <p className="text-sm font-medium text-cm-text-primary">Harmonized Store</p>
          <p className="text-xs text-cm-text-tertiary">PostgreSQL / Internal</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md bg-cm-bg-elevated px-3 py-2">
          <span className="text-xs text-cm-text-secondary">Total Rows</span>
          <span className="text-xs font-medium text-cm-text-primary">{totalRows}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-cm-bg-elevated px-3 py-2">
          <span className="text-xs text-cm-text-secondary">Sources Ingested</span>
          <span className="text-xs font-medium text-cm-text-primary">{MOCK_SOURCES.length}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-cm-bg-elevated px-3 py-2">
          <span className="text-xs text-cm-text-secondary">Mappings Applied</span>
          <span className="text-xs font-medium text-cm-text-primary">
            {acceptedMappings} / {totalMappings}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-cm-text-secondary">Tables</p>
        <div className="flex items-center gap-2 rounded-md border border-cm-border-primary px-3 py-2">
          <Check className="h-3.5 w-3.5 text-cm-success" />
          <span className="text-xs text-cm-text-primary">care_assessments</span>
          <span className="ml-auto text-[10px] text-cm-text-tertiary">247 rows</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-cm-border-primary px-3 py-2">
          <Check className="h-3.5 w-3.5 text-cm-success" />
          <span className="text-xs text-cm-text-primary">lab_results</span>
          <span className="ml-auto text-[10px] text-cm-text-tertiary">247 rows</span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-cm-border-primary px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-cm-warning" />
          <span className="text-xs text-cm-text-primary">encounters</span>
          <span className="ml-auto text-[10px] text-cm-text-tertiary">partial</span>
        </div>
      </div>
    </div>
  );
}
