import { Sparkles } from "lucide-react";
import type { SourcePreview } from "@/lib/mock-data";

interface SourceAiPromptsProps {
  preview: SourcePreview;
}

function getSuggestions(preview: SourcePreview): string[] {
  const base: string[] = [];

  const highNullCols = preview.columns.filter(
    (c) => c.nullCount / preview.totalRows > 0.2
  );
  if (highNullCols.length > 0) {
    base.push(`Fill missing values in ${highNullCols.map((c) => c.name).join(", ")}`);
  }

  const lowCardCols = preview.columns.filter(
    (c) => c.type === "string" && c.uniqueCount <= 5
  );
  if (lowCardCols.length > 0) {
    base.push("Standardize categorical values");
  }

  base.push("Detect date format inconsistencies");
  base.push("Show column distributions");
  base.push("Suggest target schema mappings");

  return base.slice(0, 4);
}

export function SourceAiPrompts({ preview }: SourceAiPromptsProps) {
  const suggestions = getSuggestions(preview);

  return (
    <div className="shrink-0 border-t border-cm-border-primary bg-cm-bg-surface px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-cm-accent" />
        <span className="text-[10px] font-medium text-cm-text-tertiary">AI suggestions</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            className="rounded-full border border-cm-border-primary bg-white px-2.5 py-1 text-[11px] text-cm-text-secondary hover:bg-cm-bg-elevated hover:text-cm-text-primary transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
