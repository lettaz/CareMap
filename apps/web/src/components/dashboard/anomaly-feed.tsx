import { useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  Check,
  Eye,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  Table2,
} from "lucide-react";
import type { QualityAlert, DashboardSourceSummary, AffectedRecord } from "@/lib/types";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SEVERITY_ORDER: Record<QualityAlert["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const SEVERITY_CONFIG: Record<
  QualityAlert["severity"],
  {
    icon: typeof AlertOctagon;
    border: string;
    badge: string;
    iconColor: string;
    label: string;
  }
> = {
  critical: {
    icon: AlertOctagon,
    border: "border-l-cm-error",
    badge: "bg-cm-error-subtle text-cm-error",
    iconColor: "text-cm-error",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-l-cm-warning",
    badge: "bg-cm-warning-subtle text-cm-warning",
    iconColor: "text-cm-warning",
    label: "Warning",
  },
  info: {
    icon: Info,
    border: "border-l-cm-info",
    badge: "bg-cm-info-subtle text-cm-info",
    iconColor: "text-cm-info",
    label: "Info",
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

function DrillThroughTable({ records }: { records: AffectedRecord[] }) {
  if (records.length === 0) return null;
  const columns = Object.keys(records[0].values);

  return (
    <div className="mt-2 overflow-x-auto rounded border border-cm-border-subtle">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-cm-border-subtle bg-cm-bg-app">
            <th className="px-2 py-1.5 text-left font-medium text-cm-text-tertiary">
              Row
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="px-2 py-1.5 text-left font-mono font-medium text-cm-text-tertiary"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((rec) => (
            <tr
              key={rec.rowIndex}
              className="border-b border-cm-border-subtle last:border-b-0"
            >
              <td className="px-2 py-1.5 tabular-nums text-cm-text-secondary">
                {rec.rowIndex}
              </td>
              {columns.map((col) => {
                const isAnomalous = rec.anomalousFields.includes(col);
                const val = rec.values[col];
                return (
                  <td
                    key={col}
                    className={cn(
                      "px-2 py-1.5 font-mono",
                      isAnomalous
                        ? "bg-cm-error-subtle font-semibold text-cm-error"
                        : "text-cm-text-secondary",
                    )}
                  >
                    {val === null ? (
                      <span className="italic text-cm-text-tertiary">null</span>
                    ) : (
                      String(val)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface AlertCardProps {
  alert: QualityAlert;
  sourceFilename?: string;
}

function AlertCard({ alert, sourceFilename }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const { projectId } = useActiveProject();
  const acknowledgeAlert = useDashboardStore((s) => s.acknowledgeAlert);
  const config = SEVERITY_CONFIG[alert.severity];
  const SeverityIcon = config.icon;
  const hasRecords =
    alert.affectedRecords != null && alert.affectedRecords.length > 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-cm-border-subtle border-l-4 bg-cm-bg-surface p-3 transition-all",
        config.border,
        alert.acknowledged && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2.5">
        <SeverityIcon
          className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconColor)}
        />

        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium",
                config.badge,
              )}
            >
              {config.label}
            </span>
            <span className="text-xs tabular-nums text-cm-text-tertiary">
              {alert.affectedCount} affected
            </span>
            {alert.createdAt && (
              <span className="flex items-center gap-1 text-xs text-cm-text-tertiary">
                <Clock className="h-3 w-3" />
                {formatTimestamp(alert.createdAt)}
              </span>
            )}
            {alert.acknowledged && (
              <span className="flex items-center gap-1 text-xs text-cm-success">
                <Check className="h-3 w-3" />
                Acknowledged
              </span>
            )}
          </div>

          {/* Summary */}
          <p
            className={cn(
              "text-sm leading-relaxed text-cm-text-primary",
              !expanded && "line-clamp-2",
            )}
          >
            {alert.summary}
          </p>
          {alert.summary.length > 100 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-0.5 text-xs font-medium text-cm-accent hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}

          {/* Footer: provenance + detection + drill-through toggle */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {sourceFilename && (
              <span className="flex items-center gap-1 text-xs text-cm-text-tertiary">
                <FileText className="h-3 w-3" />
                {sourceFilename}
              </span>
            )}
            {alert.detectionMethod && (
              <span className="text-xs text-cm-text-tertiary">
                via {alert.detectionMethod.replaceAll("_", " ")}
              </span>
            )}
            {hasRecords && (
              <button
                type="button"
                onClick={() => setShowRecords((prev) => !prev)}
                className="flex items-center gap-1 text-xs font-medium text-cm-accent hover:underline"
              >
                <Table2 className="h-3 w-3" />
                {showRecords ? "Hide records" : "View records"}
                {showRecords ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            )}
          </div>

          {/* Drill-through table */}
          {showRecords && hasRecords && (
            <DrillThroughTable records={alert.affectedRecords!} />
          )}
        </div>

        {/* Acknowledge button */}
        {!alert.acknowledged && projectId && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={() => acknowledgeAlert(projectId, alert.id)}
            aria-label="Acknowledge alert"
          >
            <Eye className="size-4 text-cm-text-tertiary" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface AnomalyFeedProps {
  alerts: QualityAlert[];
  sources: DashboardSourceSummary[];
}

export function AnomalyFeed({ alerts, sources }: AnomalyFeedProps) {
  const sourceMap = new Map(sources.map((s) => [s.id, s.filename]));

  const sorted = [...alerts].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const openCount = sorted.filter((a) => !a.acknowledged).length;

  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface shadow-[var(--cm-shadow-surface)]">
      <div className="border-b border-cm-border-primary px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[0.9375rem] font-semibold text-cm-text-primary">
              Quality Alerts
            </h3>
            <p className="mt-0.5 text-xs text-cm-text-tertiary">
              {openCount > 0
                ? `${openCount} open alert${openCount !== 1 ? "s" : ""} requiring attention`
                : "All alerts acknowledged"}
            </p>
          </div>
          {openCount > 0 && (
            <span className="rounded-full bg-cm-error-subtle px-2 py-0.5 text-xs font-medium tabular-nums text-cm-error">
              {openCount}
            </span>
          )}
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        <div className="flex flex-col gap-2 p-3">
          {sorted.length === 0 ? (
            <div className="py-6 text-center">
              <Check className="mx-auto h-6 w-6 text-cm-success" />
              <p className="mt-2 text-sm text-cm-text-tertiary">
                No quality alerts. Your data looks good.
              </p>
            </div>
          ) : (
            sorted.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                sourceFilename={
                  alert.sourceFileId
                    ? sourceMap.get(alert.sourceFileId)
                    : undefined
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
