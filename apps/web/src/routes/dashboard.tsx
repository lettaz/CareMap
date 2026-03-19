import { SourceOverview } from "@/components/dashboard/source-overview";
import { CompletenessHeatmap } from "@/components/dashboard/completeness-heatmap";
import { AnomalyFeed } from "@/components/dashboard/anomaly-feed";
import { PinnedWidgetCard } from "@/components/dashboard/pinned-widget";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useActiveProject } from "@/hooks/use-active-project";

export default function DashboardPage() {
  const { projectId } = useActiveProject();
  const dashboard = useDashboardStore((s) => projectId ? s.dashboards[projectId] : null);

  if (!projectId || !dashboard) return null;

  const { pinnedWidgets, alerts } = dashboard;
  const openAlertCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="h-full overflow-y-auto bg-cm-bg-app p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-xl font-semibold text-cm-text-primary">Dashboard</h1>

        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Total Sources" value={2} />
          <KpiCard label="Fields Mapped" value={18} trend="up" trendValue="+3" />
          <KpiCard label="Data Completeness" value="87.4%" trend="up" trendValue="+2.1%" />
          <KpiCard label="Open Alerts" value={openAlertCount} trend="down" trendValue="-1" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-6">
            <SourceOverview />
            <AnomalyFeed />
          </div>
          <div className="space-y-6">
            <CompletenessHeatmap />
            {pinnedWidgets.map((widget) => (
              <PinnedWidgetCard key={widget.id} widget={widget} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
