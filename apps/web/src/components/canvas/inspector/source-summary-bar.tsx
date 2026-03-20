import { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import type { SourcePreview } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SourceSummaryBarProps {
  preview: SourcePreview;
  onAiClick?: () => void;
  onRequestCleanup?: () => void;
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

export function SourceSummaryBar({ preview, onAiClick, onRequestCleanup }: SourceSummaryBarProps) {
  const pct = Math.round(preview.completeness * 100);
  const hasIssues = preview.issueCount > 0;
  const [cleanupRequested, setCleanupRequested] = useState(false);

  const issueColumns = preview.columns
    .filter((c) => c.nullCount / preview.totalRows > 0.1)
    .map((c) => c.name);

  const handleCleanup = () => {
    setCleanupRequested(true);
    onRequestCleanup?.();
  };

  return (
    <div className="border-b border-cm-border-primary px-4 py-3 space-y-3 shrink-0">
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
          {hasIssues && (
            <>
              <span className="text-cm-border-strong">·</span>
              <span className="text-cm-warning font-medium">
                {preview.issueCount} {preview.issueCount === 1 ? "issue" : "issues"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* AI Insight Card */}
      <div className={cn(
        "rounded-lg border overflow-hidden",
        hasIssues ? "border-amber-200 bg-amber-50/50" : "border-cm-border-primary bg-cm-bg-elevated",
      )}>
        <button
          onClick={onAiClick}
          className="group flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/60"
        >
          <Sparkles className={cn(
            "h-3.5 w-3.5 shrink-0 mt-0.5",
            hasIssues ? "text-amber-500" : "text-cm-accent",
          )} />
          <p className="flex-1 text-xs leading-relaxed text-cm-text-secondary group-hover:text-cm-text-primary">
            {preview.aiSummary}
          </p>
          <ChevronRight className="h-3.5 w-3.5 text-cm-text-tertiary shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        {hasIssues && (
          <div className="border-t border-amber-200/60 px-3 py-2 space-y-2">
            {issueColumns.length > 0 && (
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {issueColumns.map((col) => (
                    <span
                      key={col}
                      className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-800"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleCleanup}
              disabled={cleanupRequested}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all",
                cleanupRequested
                  ? "bg-cm-accent-subtle text-cm-accent cursor-default"
                  : "bg-white border border-amber-200 text-amber-800 hover:bg-amber-50 hover:border-amber-300 active:scale-[0.99]",
              )}
            >
              <Wand2 className={cn("h-3.5 w-3.5", cleanupRequested && "animate-pulse")} />
              {cleanupRequested
                ? "Cleanup plan requested — check the chat"
                : `Request cleanup plan for ${preview.issueCount} column${preview.issueCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
