import { Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { SourcePreview } from "@/lib/mock-data";

interface SourceSummaryBarProps {
  preview: SourcePreview;
}

function getHealthColor(completeness: number): string {
  if (completeness >= 0.9) return "text-cm-success";
  if (completeness >= 0.7) return "text-cm-warning";
  return "text-cm-error";
}

function getHealthBg(completeness: number): string {
  if (completeness >= 0.9) return "bg-cm-success-subtle";
  if (completeness >= 0.7) return "bg-cm-warning-subtle";
  return "bg-cm-error-subtle";
}

export function SourceSummaryBar({ preview }: SourceSummaryBarProps) {
  const pct = Math.round(preview.completeness * 100);

  return (
    <div className="border-b border-cm-border-primary px-4 py-3 space-y-3 shrink-0">
      {/* Health metrics row */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getHealthBg(preview.completeness)} ${getHealthColor(preview.completeness)}`}
        >
          {preview.completeness >= 0.9 ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {pct}% complete
        </div>

        <div className="flex items-center gap-3 text-xs text-cm-text-tertiary">
          <span>{preview.totalRows.toLocaleString()} rows</span>
          <span className="text-cm-border-strong">·</span>
          <span>{preview.totalColumns} cols</span>
          {preview.issueCount > 0 && (
            <>
              <span className="text-cm-border-strong">·</span>
              <span className="text-cm-warning font-medium">
                {preview.issueCount} {preview.issueCount === 1 ? "issue" : "issues"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* AI summary */}
      <div className="flex gap-2 rounded-md bg-cm-bg-elevated px-3 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-cm-accent shrink-0 mt-0.5" />
        <p className="text-xs text-cm-text-secondary leading-relaxed">
          {preview.aiSummary}
        </p>
      </div>
    </div>
  );
}
