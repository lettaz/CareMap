import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { fetchProfile, type ColumnProfileDTO } from "@/lib/api/ingest";
import type { ColumnProfile } from "@/lib/types";

interface ProfileTabProps {
  sourceFileId: string;
}

function dtoToProfile(dto: ColumnProfileDTO): ColumnProfile {
  return {
    id: dto.id,
    sourceFileId: dto.source_file_id,
    columnName: dto.column_name,
    inferredType: dto.inferred_type as ColumnProfile["inferredType"],
    semanticLabel: dto.semantic_label,
    domain: dto.domain,
    confidence: dto.confidence,
    sampleValues: dto.sample_values as (string | number)[],
    qualityFlags: dto.quality_flags,
    userCorrected: false,
  };
}

export function ProfileTab({ sourceFileId }: ProfileTabProps) {
  const [profiles, setProfiles] = useState<ColumnProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sourceFileId) return;
    setLoading(true);
    fetchProfile(sourceFileId)
      .then((dtos) => setProfiles(dtos.map(dtoToProfile)))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, [sourceFileId]);

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center text-cm-text-tertiary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <p className="mt-3 text-sm text-cm-text-tertiary">
        No profile data available. Upload a file first.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {profiles.map((col) => (
        <div
          key={col.id}
          className="rounded-md border border-cm-border-primary bg-cm-bg-surface p-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-cm-text-primary font-mono">
              {col.columnName}
            </span>
            <span className="text-xs text-cm-text-tertiary capitalize">{col.inferredType}</span>
          </div>
          <p className="mt-0.5 text-xs text-cm-text-secondary">{col.semanticLabel}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <ConfidenceBar value={col.confidence} />
            <span className="text-xs text-cm-text-tertiary whitespace-nowrap">
              {(col.confidence * 100).toFixed(0)}%
            </span>
          </div>
          {col.qualityFlags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {col.qualityFlags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-full bg-cm-warning-subtle px-1.5 py-0.5 text-[10px] text-cm-warning"
                >
                  {flag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
