import { MOCK_PROFILES } from "@/lib/mock-data";
import { ConfidenceBar } from "@/components/shared/confidence-bar";

interface ProfileTabProps {
  sourceFileId: string;
}

export function ProfileTab({ sourceFileId }: ProfileTabProps) {
  const fileId = sourceFileId.startsWith("source-") ? "src-001" : sourceFileId;
  const profiles = MOCK_PROFILES[fileId] ?? MOCK_PROFILES["src-001"] ?? [];

  if (profiles.length === 0) {
    return (
      <p className="mt-3 text-sm text-cm-text-tertiary">
        No profile data available. Upload a file and run the Builder Agent.
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
