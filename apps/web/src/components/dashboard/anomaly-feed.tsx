import { useState } from "react";
import { Eye } from "lucide-react";
import type { QualityAlert } from "@/lib/types";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<QualityAlert["severity"], { border: string; badge: string; label: string }> = {
  critical: { border: "border-l-red-500", badge: "bg-cm-error-subtle text-cm-error", label: "Critical" },
  warning: { border: "border-l-amber-500", badge: "bg-cm-warning-subtle text-cm-warning", label: "Warning" },
  info: { border: "border-l-blue-500", badge: "bg-cm-info-subtle text-cm-info", label: "Info" },
};

function AlertCard({ alert }: { alert: QualityAlert }) {
  const [expanded, setExpanded] = useState(false);
  const { projectId } = useActiveProject();
  const acknowledgeAlert = useDashboardStore((s) => s.acknowledgeAlert);
  const style = SEVERITY_STYLES[alert.severity];

  return (
    <div
      className={cn(
        "rounded-lg border border-cm-border-subtle border-l-4 bg-cm-bg-surface p-3 transition-opacity",
        style.border,
        alert.acknowledged && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", style.badge)}>{style.label}</span>
            <span className="text-xs text-cm-text-tertiary">{alert.affectedCount} affected</span>
          </div>
          <p className={cn("text-sm text-cm-text-primary", !expanded && "line-clamp-2")}>{alert.summary}</p>
          {alert.summary.length > 120 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-0.5 text-xs font-medium text-cm-accent hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
          {alert.detectionMethod && (
            <p className="mt-1 text-xs text-cm-text-tertiary">via {alert.detectionMethod.replaceAll("_", " ")}</p>
          )}
        </div>
        {!alert.acknowledged && projectId && (
          <Button
            variant="ghost"
            size="icon-sm"
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

export function AnomalyFeed() {
  const { projectId } = useActiveProject();
  const alerts = useDashboardStore((s) => projectId ? s.dashboards[projectId]?.alerts ?? [] : []);

  return (
    <div className="rounded-lg border border-cm-border-subtle bg-cm-bg-surface">
      <div className="border-b border-cm-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-cm-text-primary">Quality Alerts</h3>
      </div>
      <div className="flex flex-col gap-2 p-3">
        {alerts.length === 0 ? (
          <p className="py-4 text-center text-sm text-cm-text-tertiary">No alerts</p>
        ) : (
          alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
        )}
      </div>
    </div>
  );
}
