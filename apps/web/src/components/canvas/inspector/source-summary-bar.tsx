import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import type { SourcePreview } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SourceSummaryBarProps {
  preview: SourcePreview;
  onAiClick?: () => void;
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

export function SourceSummaryBar({ preview, onAiClick }: SourceSummaryBarProps) {
  const pct = Math.round(preview.completeness * 100);

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
        </div>
      </div>

      <div className={cn(
        "rounded-lg border overflow-hidden",
        "border-cm-border-primary bg-cm-bg-elevated",
      )}>
        <button
          onClick={onAiClick}
          className="group flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/60"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-cm-accent" />
          <p className="flex-1 text-xs leading-relaxed text-cm-text-secondary group-hover:text-cm-text-primary">
            {preview.aiSummary}
          </p>
          <ChevronRight className="h-3.5 w-3.5 text-cm-text-tertiary shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
    </div>
  );
}
