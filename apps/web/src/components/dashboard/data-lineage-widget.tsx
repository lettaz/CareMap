import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowRight, GitBranch } from "lucide-react";
import type { LineageEntry, DashboardSourceSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DataLineageWidgetProps {
  entries: LineageEntry[];
  sources: DashboardSourceSummary[];
}

export function DataLineageWidget({ entries, sources }: DataLineageWidgetProps) {
  const sourceMap = new Map(sources.map((s) => [s.id, s.filename]));
  const grouped = entries.reduce<Record<string, LineageEntry[]>>((acc, e) => {
    (acc[e.metricLabel] ??= []).push(e);
    return acc;
  }, {});

  const metricLabels = Object.keys(grouped);

  if (metricLabels.length === 0) {
    return (
      <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface p-6 text-center shadow-[var(--cm-shadow-surface)]">
        <GitBranch className="mx-auto h-6 w-6 text-cm-text-tertiary" />
        <p className="mt-2 text-sm text-cm-text-tertiary">
          No lineage data available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface shadow-[var(--cm-shadow-surface)]">
      <div className="border-b border-cm-border-primary px-5 py-3.5">
        <h3 className="text-[0.9375rem] font-semibold text-cm-text-primary">
          Data Lineage
        </h3>
        <p className="mt-0.5 text-xs text-cm-text-tertiary">
          Trace dashboard metrics back to source files and transformations
        </p>
      </div>
      <div className="max-h-[380px] overflow-y-auto">
        <div className="flex flex-col">
          {metricLabels.map((metric) => (
            <LineageGroup
              key={metric}
              metric={metric}
              entries={grouped[metric]}
              sourceMap={sourceMap}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LineageGroup({
  metric,
  entries,
  sourceMap,
}: {
  metric: string;
  entries: LineageEntry[];
  sourceMap: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-cm-border-subtle last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 px-5 py-3 text-left transition-colors hover:bg-cm-bg-elevated"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-cm-text-tertiary" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-cm-text-tertiary" />
        )}
        <span className="text-sm font-medium text-cm-text-primary">
          {metric}
        </span>
        <span className="ml-auto text-xs text-cm-text-tertiary">
          {entries.length} source{entries.length !== 1 ? "s" : ""}
        </span>
      </button>

      {open && (
        <div className="space-y-2 px-5 pb-3">
          {entries.map((entry, i) => {
            const filename = sourceMap.get(entry.sourceFileId) ?? entry.sourceFileId;
            return (
              <div
                key={i}
                className="flex flex-col gap-1.5 rounded-md border border-cm-border-subtle bg-cm-bg-app p-3"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-cm-node-source-subtle px-1.5 py-0.5 font-mono font-medium text-cm-node-source">
                    {filename}
                  </span>
                  <span className="font-mono text-cm-text-secondary">
                    .{entry.sourceColumn}
                  </span>
                </div>

                {entry.transformations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {entry.transformations.map((t, ti) => (
                      <span key={ti} className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3 text-cm-text-tertiary" />
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5",
                            "bg-cm-accent-subtle text-cm-accent font-medium",
                          )}
                        >
                          {t}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs">
                  <ArrowRight className="h-3 w-3 text-cm-text-tertiary" />
                  <span className="rounded bg-cm-node-sink-subtle px-1.5 py-0.5 font-mono font-medium text-cm-node-sink">
                    {entry.targetField}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
