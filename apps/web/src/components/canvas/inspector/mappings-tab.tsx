import { useState } from "react";
import { Check, X, HelpCircle } from "lucide-react";
import { MOCK_MAPPINGS } from "@/lib/mock-data";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import type { MappingStatus } from "@/lib/types";

interface MappingsTabProps {
  sourceFileId?: string;
}

const STATUS_CONFIG: Record<MappingStatus, { icon: typeof Check; className: string }> = {
  accepted: { icon: Check, className: "text-cm-success" },
  rejected: { icon: X, className: "text-cm-error" },
  pending: { icon: HelpCircle, className: "text-cm-warning" },
};

export function MappingsTab({ sourceFileId }: MappingsTabProps) {
  const allMappings = sourceFileId
    ? MOCK_MAPPINGS.filter((m) =>
        m.sourceFileId === sourceFileId ||
        m.sourceFileId === (sourceFileId.startsWith("source-") ? "src-001" : sourceFileId)
      )
    : MOCK_MAPPINGS;

  const [mappings, setMappings] = useState(allMappings);

  const updateStatus = (id: string, status: MappingStatus) => {
    setMappings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status } : m))
    );
  };

  if (mappings.length === 0) {
    return (
      <p className="mt-3 text-sm text-cm-text-tertiary">
        No mapping suggestions yet. Run the Builder Agent to generate mappings.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
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
                  → {mapping.targetTable}.{mapping.targetColumn}
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
                  onClick={() => updateStatus(mapping.id, "accepted")}
                  className="flex items-center gap-1 rounded bg-cm-success-subtle px-2 py-1 text-[10px] font-medium text-cm-success hover:bg-cm-success/10 transition-colors"
                >
                  <Check className="h-3 w-3" /> Accept
                </button>
                <button
                  onClick={() => updateStatus(mapping.id, "rejected")}
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
  );
}
