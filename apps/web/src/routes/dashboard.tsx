import { useEffect, useState } from "react";
import {
  Database,
  GitBranch,
  BarChart3,
  AlertTriangle,
  Layers,
  Pin,
  Upload,
} from "lucide-react";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { SourceOverview } from "@/components/dashboard/source-overview";
import { CompletenessHeatmap } from "@/components/dashboard/completeness-heatmap";
import { AnomalyFeed } from "@/components/dashboard/anomaly-feed";
import { PinnedWidgetCard } from "@/components/dashboard/pinned-widget";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DataLineageWidget } from "@/components/dashboard/data-lineage-widget";
import { CorrectionsLog } from "@/components/dashboard/corrections-log";
import { useDashboardStore, computeKpis } from "@/lib/stores/dashboard-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { cn } from "@/lib/utils";

function widgetColSpan(chartType: string): string {
  switch (chartType) {
    case "line":
      return "lg:col-span-2";
    case "bar":
      return "lg:col-span-1";
    default:
      return "lg:col-span-1";
  }
}

type Tab = "overview" | "insights";

interface DashboardTabsProps {
  kpis: ReturnType<typeof computeKpis>;
  sources: ReturnType<typeof useDashboardStore.getState>["dashboards"][string]["sources"];
  completeness: ReturnType<typeof useDashboardStore.getState>["dashboards"][string]["completeness"];
  alerts: ReturnType<typeof useDashboardStore.getState>["dashboards"][string]["alerts"];
  lineage: ReturnType<typeof useDashboardStore.getState>["dashboards"][string]["lineage"];
  corrections: ReturnType<typeof useDashboardStore.getState>["dashboards"][string]["corrections"];
  pinnedWidgets: ReturnType<typeof useDashboardStore.getState>["dashboards"][string]["pinnedWidgets"];
}

function DashboardTabs({ kpis, sources, completeness, alerts, lineage, corrections, pinnedWidgets }: DashboardTabsProps) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="h-full overflow-y-auto bg-cm-bg-app">
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        {/* Header + Tabs */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-cm-text-primary">Dashboard</h1>
            <p className="mt-1 text-sm text-cm-text-secondary">
              Quality overview and pinned insights for this project.
            </p>
          </div>
          <div data-tour="dashboard-tabs" className="flex gap-1 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-0.5">
            <button
              onClick={() => setTab("overview")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "overview"
                  ? "bg-cm-accent text-white"
                  : "text-cm-text-secondary hover:text-cm-text-primary hover:bg-cm-bg-elevated",
              )}
            >
              Overview
            </button>
            <button
              onClick={() => setTab("insights")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "insights"
                  ? "bg-cm-accent text-white"
                  : "text-cm-text-secondary hover:text-cm-text-primary hover:bg-cm-bg-elevated",
              )}
            >
              <Pin className="h-3 w-3" />
              Insights
              {pinnedWidgets.length > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  tab === "insights"
                    ? "bg-white/20 text-white"
                    : "bg-cm-accent-subtle text-cm-accent",
                )}>
                  {pinnedWidgets.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-6 space-y-6 sm:space-y-8">
          {tab === "overview" && (
            <>
              {/* KPI Row */}
              <div data-tour="dashboard-kpis" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
                <KpiCard label="Total Sources" value={kpis.totalSources} icon={Database} iconColor="text-cm-node-source" />
                <KpiCard label="Rows Harmonized" value={kpis.totalRowsHarmonized.toLocaleString()} icon={Layers} iconColor="text-cm-node-sink" />
                <KpiCard label="Fields Mapped" value={`${kpis.fieldsMapped}/${kpis.fieldsTotal}`} icon={GitBranch} iconColor="text-cm-node-transform" trend="up" trendValue="+3 this session" />
                <KpiCard label="Data Completeness" value={`${kpis.dataCompleteness}%`} icon={BarChart3} iconColor="text-cm-success" trend="up" trendValue="+2.1%" />
                <KpiCard
                  label="Open Alerts"
                  value={kpis.openAlerts}
                  icon={AlertTriangle}
                  iconColor={kpis.openAlerts > 0 ? "text-cm-warning" : "text-cm-text-tertiary"}
                  trend={kpis.openAlerts > 0 ? "down" : "flat"}
                  trendValue={kpis.openAlerts > 0 ? "-1 resolved" : "\u2014"}
                  trendPositive={true}
                />
              </div>

              {/* Quality Overview */}
              <section>
                <h2 className="mb-4 text-lg font-semibold text-cm-text-primary">Quality Overview</h2>
                <div className="space-y-6">
                  <SourceOverview sources={sources} />
                  <CompletenessHeatmap data={completeness} />
                  <AnomalyFeed alerts={alerts} sources={sources} />
                </div>
              </section>

              {/* Provenance & Changes */}
              <section>
                <h2 className="mb-4 text-lg font-semibold text-cm-text-primary">Provenance & Changes</h2>
                <div className="space-y-6">
                  <DataLineageWidget entries={lineage} sources={sources} />
                  <CorrectionsLog corrections={corrections} sources={sources} />
                </div>
              </section>
            </>
          )}

          {tab === "insights" && (
            <>
              {pinnedWidgets.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  {pinnedWidgets.map((widget) => (
                    <div key={widget.id} className={widgetColSpan(widget.chartSpec.type)}>
                      <PinnedWidgetCard widget={widget} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-cm-border-primary bg-cm-bg-surface px-6 py-16 text-center">
                  <Pin className="mx-auto h-8 w-8 text-cm-text-tertiary" />
                  <h3 className="mt-3 text-sm font-semibold text-cm-text-primary">
                    No pinned insights yet
                  </h3>
                  <p className="mt-1 text-sm text-cm-text-secondary">
                    Generate charts in the chat panel and pin them here for quick access.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { projectId } = useActiveProject();
  const dashboard = useDashboardStore((s) =>
    projectId ? s.dashboards[projectId] : null,
  );
  const loading = useDashboardStore((s) => s.loading);
  const error = useDashboardStore((s) => s.error);
  const loadDashboard = useDashboardStore((s) => s.loadDashboard);

  useEffect(() => {
    if (projectId) loadDashboard(projectId);
  }, [projectId, loadDashboard]);

  if (!projectId) return null;

  const isInitialLoad = loading && (!dashboard || dashboard.sources.length === 0);

  if (isInitialLoad) {
    return (
      <div className="h-full overflow-y-auto bg-cm-bg-app">
        <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8 p-4 sm:p-6">
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-cm-border-primary bg-cm-bg-surface p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-7 w-16" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="h-full bg-cm-bg-app p-6">
        <ErrorState
          message={error}
          onRetry={() => loadDashboard(projectId)}
        />
      </div>
    );
  }

  if (!dashboard) return null;

  const { pinnedWidgets, sources, completeness, alerts, lineage, corrections } =
    dashboard;
  const kpis = computeKpis(dashboard);
  const isEmpty = sources.length === 0;

  if (isEmpty && !loading) {
    return (
      <div className="flex h-full items-center justify-center bg-cm-bg-app">
        <div className="mx-auto max-w-md px-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cm-accent-subtle">
            <Upload className="h-7 w-7 text-cm-accent" />
          </div>
          <h1 className="mt-6 text-xl font-semibold text-cm-text-primary">
            No data harmonized yet
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-cm-text-secondary">
            Upload source files and run harmonization from the canvas to see
            quality metrics, alerts, and insights here.
          </p>
          <Link
            to={`/projects/${projectId}/canvas`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cm-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cm-accent-hover"
          >
            Go to Canvas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DashboardTabs
      kpis={kpis}
      sources={sources}
      completeness={completeness}
      alerts={alerts}
      lineage={lineage}
      corrections={corrections}
      pinnedWidgets={pinnedWidgets}
    />
  );
}
