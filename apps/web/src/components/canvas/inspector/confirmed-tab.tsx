import { Check } from "lucide-react";
import { MOCK_MAPPINGS } from "@/lib/mock-data";

export function ConfirmedTab() {
  const confirmed = MOCK_MAPPINGS.filter((m) => m.status === "accepted");

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
              → {mapping.targetTable}.{mapping.targetColumn}
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
