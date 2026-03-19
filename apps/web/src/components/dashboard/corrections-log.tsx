import {
  GitBranch,
  Wrench,
  RefreshCw,
  PenLine,
  Bot,
  User,
  FileText,
  Clock,
  History,
} from "lucide-react";
import type { CorrectionEntry, DashboardSourceSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_CONFIG: Record<
  CorrectionEntry["action"],
  { icon: typeof GitBranch; color: string; label: string }
> = {
  mapping_change: {
    icon: GitBranch,
    color: "text-cm-node-transform bg-cm-node-transform-subtle",
    label: "Mapping",
  },
  value_fix: {
    icon: Wrench,
    color: "text-cm-warning bg-cm-warning-subtle",
    label: "Value Fix",
  },
  schema_update: {
    icon: RefreshCw,
    color: "text-cm-info bg-cm-info-subtle",
    label: "Schema",
  },
  field_rename: {
    icon: PenLine,
    color: "text-cm-accent bg-cm-accent-subtle",
    label: "Rename",
  },
};

function formatTimestamp(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface CorrectionsLogProps {
  corrections: CorrectionEntry[];
  sources: DashboardSourceSummary[];
}

export function CorrectionsLog({ corrections, sources }: CorrectionsLogProps) {
  const sourceMap = new Map(sources.map((s) => [s.id, s.filename]));
  const sorted = [...corrections].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface shadow-[var(--cm-shadow-surface)]">
      <div className="border-b border-cm-border-primary px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[0.9375rem] font-semibold text-cm-text-primary">
              Corrections Log
            </h3>
            <p className="mt-0.5 text-xs text-cm-text-tertiary">
              History of applied fixes, mappings, and schema changes
            </p>
          </div>
          <span className="rounded-full bg-cm-bg-elevated px-2 py-0.5 text-xs font-medium tabular-nums text-cm-text-secondary">
            {corrections.length}
          </span>
        </div>
      </div>

      <div className="max-h-[380px] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="py-8 text-center">
            <History className="mx-auto h-6 w-6 text-cm-text-tertiary" />
            <p className="mt-2 text-sm text-cm-text-tertiary">
              No corrections applied yet.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[1.625rem] top-0 h-full w-px bg-cm-border-subtle" />

            {sorted.map((entry) => {
              const config = ACTION_CONFIG[entry.action];
              const ActionIcon = config.icon;
              const filename = entry.sourceFileId
                ? sourceMap.get(entry.sourceFileId)
                : undefined;

              return (
                <div
                  key={entry.id}
                  className="relative flex gap-3 px-5 py-3 transition-colors hover:bg-cm-bg-elevated"
                >
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      config.color,
                    )}
                  >
                    <ActionIcon className="h-3 w-3" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs font-medium",
                          config.color,
                        )}
                      >
                        {config.label}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-cm-text-tertiary">
                        {entry.appliedBy === "ai" ? (
                          <Bot className="h-3 w-3" />
                        ) : (
                          <User className="h-3 w-3" />
                        )}
                        {entry.appliedBy === "ai" ? "AI" : "Manual"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-cm-text-tertiary">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>

                    <p className="text-sm text-cm-text-primary">
                      {entry.description}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {filename && (
                        <span className="flex items-center gap-1 text-xs text-cm-text-tertiary">
                          <FileText className="h-3 w-3" />
                          {filename}
                        </span>
                      )}
                      {entry.previousValue && entry.newValue && (
                        <span className="text-xs text-cm-text-tertiary">
                          <span className="line-through">{entry.previousValue}</span>
                          {" → "}
                          <span className="font-medium text-cm-text-secondary">
                            {entry.newValue}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
