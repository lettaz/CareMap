import { useState, useEffect } from "react";
import { Check, Loader2 } from "lucide-react";
import { useActiveProject } from "@/hooks/use-active-project";
import { fetchMappings, type FieldMappingDTO } from "@/lib/api/mappings";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetchMappings(projectId)
      .then((dtos: FieldMappingDTO[]) =>
        setConfirmed(
          dtos
            .filter((m) => m.status === "accepted")
            .map((m) => ({
              id: m.id,
              sourceColumn: m.source_column,
              targetTable: m.target_table,
              targetColumn: m.target_column,
              confidence: m.confidence,
            })),
        ),
      )
      .catch(() => setConfirmed([]))
      .finally(() => setLoading(false));
  }, [projectId]);

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
    <div className="mt-3 space-y-1.5">
      <p className="text-xs text-cm-text-secondary">
        {confirmed.length} mappings confirmed
      </p>
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
  );
}
