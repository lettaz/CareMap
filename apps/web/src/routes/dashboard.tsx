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
import { SourceOverview } from "@/components/dashboard/source-overview";
import { CompletenessHeatmap } from "@/components/dashboard/completeness-heatmap";
import { AnomalyFeed } from "@/components/dashboard/anomaly-feed";
import { PinnedWidgetCard } from "@/components/dashboard/pinned-widget";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DataLineageWidget } from "@/components/dashboard/data-lineage-widget";
import { CorrectionsLog } from "@/components/dashboard/corrections-log";
import { useDashboardStore, computeKpis } from "@/lib/stores/dashboard-store";
import { useActiveProject } from "@/hooks/use-active-project";

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

export default function DashboardPage() {
  const { projectId } = useActiveProject();
  const dashboard = useDashboardStore((s) =>
    projectId ? s.dashboards[projectId] : null,
  );

  if (!projectId || !dashboard) return null;

  const { pinnedWidgets, sources, completeness, alerts, lineage, corrections } =
    dashboard;
  const kpis = computeKpis(dashboard);
  const isEmpty = sources.length === 0;

  if (isEmpty) {
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
    <div className="h-full overflow-y-auto bg-cm-bg-app">
      <div className="mx-auto max-w-7xl space-y-8 p-6">
        {/* ── Page Header ── */}
        <div>
          <h1 className="text-2xl font-semibold text-cm-text-primary">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-cm-text-secondary">
            Quality overview and pinned insights for this project.
          </p>
        </div>

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiCard
            label="Total Sources"
            value={kpis.totalSources}
            icon={Database}
            iconColor="text-cm-node-source"
          />
          <KpiCard
            label="Rows Harmonized"
            value={kpis.totalRowsHarmonized.toLocaleString()}
            icon={Layers}
            iconColor="text-cm-node-sink"
          />
          <KpiCard
            label="Fields Mapped"
            value={`${kpis.fieldsMapped}/${kpis.fieldsTotal}`}
            icon={GitBranch}
            iconColor="text-cm-node-transform"
            trend="up"
            trendValue="+3 this session"
          />
          <KpiCard
            label="Data Completeness"
            value={`${kpis.dataCompleteness}%`}
            icon={BarChart3}
            iconColor="text-cm-success"
            trend="up"
            trendValue="+2.1%"
          />
          <KpiCard
            label="Open Alerts"
            value={kpis.openAlerts}
            icon={AlertTriangle}
            iconColor={
              kpis.openAlerts > 0 ? "text-cm-warning" : "text-cm-text-tertiary"
            }
            trend={kpis.openAlerts > 0 ? "down" : "flat"}
            trendValue={kpis.openAlerts > 0 ? "-1 resolved" : "—"}
            trendPositive={true}
          />
        </div>

        {/* ── Quality Overview ── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-cm-text-primary">
            Quality Overview
          </h2>
          <div className="space-y-6">
            <SourceOverview sources={sources} />

            <div className="grid gap-6 lg:grid-cols-2">
              <CompletenessHeatmap data={completeness} />
              <AnomalyFeed alerts={alerts} sources={sources} />
            </div>
          </div>
        </section>

        {/* ── Data Lineage & Corrections ── */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-cm-text-primary">
            Provenance & Changes
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <DataLineageWidget entries={lineage} sources={sources} />
            <CorrectionsLog corrections={corrections} sources={sources} />
          </div>
        </section>

        {/* ── Pinned Widgets ── */}
        {pinnedWidgets.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Pin className="h-4 w-4 text-cm-text-tertiary" />
              <h2 className="text-lg font-semibold text-cm-text-primary">
                Pinned Insights
              </h2>
              <span className="rounded-full bg-cm-accent-subtle px-2 py-0.5 text-xs font-medium text-cm-accent">
                {pinnedWidgets.length}
              </span>
            </div>
            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {pinnedWidgets.map((widget) => (
                <div
                  key={widget.id}
                  className={widgetColSpan(widget.chartSpec.type)}
                >
                  <PinnedWidgetCard widget={widget} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty Pinned State ── */}
        {pinnedWidgets.length === 0 && (
          <section className="rounded-lg border border-dashed border-cm-border-primary bg-cm-bg-surface px-6 py-10 text-center">
            <Pin className="mx-auto h-8 w-8 text-cm-text-tertiary" />
            <h3 className="mt-3 text-sm font-semibold text-cm-text-primary">
              No pinned insights yet
            </h3>
            <p className="mt-1 text-sm text-cm-text-secondary">
              Generate charts in the chat panel and pin them here for quick
              access.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
