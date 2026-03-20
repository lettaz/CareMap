import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Download, Table2, BarChart3, CheckCircle2, XCircle, Pin, Check,
  Wand2, ChevronDown, ChevronRight, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#3b82f6",
];

interface ToolResultRendererProps {
  toolName: string;
  output: unknown;
}

export function ToolResultRenderer({ toolName, output }: ToolResultRendererProps) {
  if (!output || typeof output !== "object") return null;

  const data = output as Record<string, unknown>;

  switch (toolName) {
    case "run_query":
      return <QueryResult data={data} />;
    case "export_data":
      return <ExportResult data={data} />;
    case "suggest_cleaning":
      return <CleaningPlanResult data={data} />;
    case "execute_cleaning":
    case "run_harmonization":
      return <PipelineResult data={data} toolName={toolName} />;
    case "propose_target_schema":
      return <SchemaResult data={data} />;
    case "run_script":
      return <ScriptResult data={data} />;
    case "profile_columns":
      return <ProfileResult data={data} />;
    case "generate_artifact":
      return <ArtifactResult data={data} />;
    default:
      return <GenericResult data={data} />;
  }
}

function QueryResult({ data }: { data: Record<string, unknown> }) {
  const columns = data.columns as string[] | undefined;
  const rows = data.rows as Record<string, unknown>[] | undefined;
  const generatedCode = data.generatedCode as string | undefined;
  const codeType = data.codeType as string | undefined;
  const rowCount = rows?.length ?? 0;

  return (
    <div className="space-y-2 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
      {generatedCode && (
        <div className="rounded-md overflow-hidden">
          <CodeBlock code={generatedCode} language={codeType === "python" ? "python" : "sql"} />
        </div>
      )}
      {columns && rows && rowCount > 0 && (
        <div className="overflow-x-auto rounded-md border border-cm-border-subtle">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-cm-bg-elevated">
                {columns.map((col) => (
                  <th key={col} className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-cm-text-secondary">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, i) => (
                <tr key={i} className="border-t border-cm-border-subtle">
                  {columns.map((col) => (
                    <td key={col} className="whitespace-nowrap px-3 py-1 text-cm-text-primary">
                      {String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rowCount > 20 && (
            <p className="px-3 py-1 text-xs text-cm-text-tertiary">
              Showing 20 of {rowCount} rows
            </p>
          )}
        </div>
      )}
      {rowCount === 0 && (
        <p className="text-xs text-cm-text-secondary flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5" /> No rows returned
        </p>
      )}
    </div>
  );
}

function ExportResult({ data }: { data: Record<string, unknown> }) {
  const success = data.success as boolean;
  const url = data.downloadUrl as string | undefined;
  const filename = data.filename as string | undefined;
  const format = data.format as string | undefined;

  if (!success) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        <XCircle className="h-4 w-4 shrink-0" />
        Export failed: {String(data.error ?? "Unknown error")}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-green-50">
        <Download className="h-4 w-4 text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-cm-text-primary truncate">{filename ?? "export"}</p>
        <p className="text-xs text-cm-text-tertiary">{format?.toUpperCase()} file ready</p>
      </div>
      {url && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 text-xs"
          onClick={() => window.open(url, "_blank")}
        >
          Download
        </Button>
      )}
    </div>
  );
}

function PipelineResult({ data, toolName }: { data: Record<string, unknown>; toolName: string }) {
  const success = data.success as boolean;
  const label = toolName === "execute_cleaning" ? "Cleaning" : "Harmonization";

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border p-3 text-xs",
      success
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-red-200 bg-red-50 text-red-700"
    )}>
      {success ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0" />
      )}
      <span className="font-medium">{label}</span>
      <span>{success ? "completed successfully" : `failed: ${String(data.error ?? "")}`}</span>
    </div>
  );
}

function SchemaResult({ data }: { data: Record<string, unknown> }) {
  const tables = data.tables as Array<{
    name: string;
    description?: string;
    columns: Array<string | { name: string; type: string; description?: string; required?: boolean }>;
  }> | undefined;

  if (!tables?.length) return null;

  return (
    <div className="space-y-2 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
      <p className="text-xs font-medium text-cm-text-secondary flex items-center gap-1.5">
        <Table2 className="h-3.5 w-3.5" /> Proposed Schema
      </p>
      {tables.map((table) => (
        <div key={table.name} className="rounded-md border border-cm-border-subtle p-2">
          <p className="text-xs font-semibold text-cm-text-primary mb-1">{table.name}</p>
          {table.description && (
            <p className="text-[10px] text-cm-text-tertiary mb-1.5">{table.description}</p>
          )}
          <div className="space-y-0.5">
            {table.columns.map((col) => {
              const isObj = typeof col === "object";
              const name = isObj ? col.name : col;
              const type = isObj ? col.type : undefined;
              const required = isObj ? col.required : false;
              return (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-cm-text-primary">{name}</span>
                  {type && (
                    <span className="rounded bg-cm-bg-elevated px-1 py-0.5 text-[10px] text-cm-text-tertiary font-mono">
                      {type}
                    </span>
                  )}
                  {required && (
                    <span className="text-[9px] text-cm-accent font-medium uppercase">req</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScriptResult({ data }: { data: Record<string, unknown> }) {
  const generatedCode = data.generatedCode as string | undefined;
  const output = data.output ?? data.result;

  return (
    <div className="space-y-2 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
      {generatedCode && (
        <div className="rounded-md overflow-hidden">
          <CodeBlock code={generatedCode} language="python" />
        </div>
      )}
      {output != null && (
        <div className="text-xs text-cm-text-primary bg-cm-bg-elevated rounded-md p-2 font-mono whitespace-pre-wrap">
          {typeof output === "string" ? output : JSON.stringify(output as object, null, 2)}
        </div>
      )}
    </div>
  );
}

function ProfileResult({ data }: { data: Record<string, unknown> }) {
  const columns = (data.columns ?? data.profiles) as Array<{
    columnName: string;
    inferredType: string;
    semanticLabel: string;
    confidence: number;
    qualityFlags?: string[];
  }> | undefined;

  if (!columns?.length) return <GenericResult data={data} />;

  const summary = data.summary as { suggestedLabel?: string; overallQuality?: string } | undefined;
  const qualityColor = summary?.overallQuality === "good"
    ? "bg-green-50 text-green-700"
    : summary?.overallQuality === "fair"
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";

  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cm-border-subtle bg-cm-bg-elevated">
        <div className="flex items-center gap-1.5 text-xs font-medium text-cm-text-primary">
          <BarChart3 className="h-3.5 w-3.5 text-cm-accent" />
          {summary?.suggestedLabel ?? `${columns.length} columns profiled`}
        </div>
        {summary?.overallQuality && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", qualityColor)}>
            {summary.overallQuality}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-cm-border-subtle bg-cm-bg-elevated/50">
              <th className="px-3 py-1.5 text-left font-medium text-cm-text-tertiary">Column</th>
              <th className="px-3 py-1.5 text-left font-medium text-cm-text-tertiary">Type</th>
              <th className="px-3 py-1.5 text-left font-medium text-cm-text-tertiary">Label</th>
              <th className="px-3 py-1.5 text-right font-medium text-cm-text-tertiary">Conf.</th>
              <th className="px-3 py-1.5 text-left font-medium text-cm-text-tertiary">Flags</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => (
              <tr key={col.columnName} className="border-b border-cm-border-subtle last:border-b-0">
                <td className="px-3 py-1.5 font-mono text-cm-text-primary whitespace-nowrap">{col.columnName}</td>
                <td className="px-3 py-1.5">
                  <span className="rounded bg-cm-bg-elevated px-1.5 py-0.5 text-cm-text-tertiary">{col.inferredType}</span>
                </td>
                <td className="px-3 py-1.5 text-cm-text-secondary">{col.semanticLabel}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-cm-text-tertiary">{Math.round(col.confidence * 100)}%</td>
                <td className="px-3 py-1.5">
                  {col.qualityFlags && col.qualityFlags.length > 0 ? (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                      {col.qualityFlags.map((f) => f.replace(/_/g, " ")).join(", ")}
                    </span>
                  ) : (
                    <span className="text-cm-text-tertiary">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ChartSpec {
  chartType: "bar" | "line" | "pie" | "scatter" | "area";
  title: string;
  xKey: string;
  yKey: string;
  data: Record<string, unknown>[];
  description?: string;
}

function ArtifactResult({ data }: { data: Record<string, unknown> }) {
  const { projectId } = useParams<{ projectId: string }>();
  const pinWidget = useDashboardStore((s) => s.pinWidget);
  const [pinned, setPinned] = useState(false);

  const artifactType = data.artifactType as string | undefined;
  if (artifactType !== "chart") return <GenericResult data={data} />;

  const spec = data.data as ChartSpec | undefined;
  if (!spec?.data?.length || !spec.chartType) return <GenericResult data={data} />;

  const handlePin = async () => {
    if (!projectId || pinned) return;
    try {
      await pinWidget(projectId, {
        title: spec.title,
        queryText: spec.description ?? spec.title,
        queryCode: "",
        chartSpec: {
          type: spec.chartType as "bar" | "line" | "pie" | "heatmap",
          title: spec.title,
          data: spec.data,
          xKey: spec.xKey,
          yKey: spec.yKey,
        },
      });
      setPinned(true);
      toast.success("Pinned to dashboard");
      setTimeout(() => setPinned(false), 3000);
    } catch {
      toast.error("Failed to pin to dashboard");
    }
  };

  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cm-border-subtle bg-cm-bg-elevated">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-cm-accent" />
          <span className="text-xs font-medium text-cm-text-primary">{spec.title}</span>
        </div>
        <button
          type="button"
          onClick={handlePin}
          disabled={pinned}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
            pinned
              ? "bg-green-50 text-green-700"
              : "bg-cm-accent-subtle text-cm-accent hover:bg-cm-accent-muted",
          )}
        >
          {pinned ? <Check className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          {pinned ? "Pinned" : "Pin to Dashboard"}
        </button>
      </div>

      <div className="p-3" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(spec)}
        </ResponsiveContainer>
      </div>

      {spec.description && (
        <div className="border-t border-cm-border-subtle px-3 py-2 text-xs text-cm-text-secondary">
          {spec.description}
        </div>
      )}
    </div>
  );
}

function renderChart(spec: ChartSpec) {
  const { chartType, xKey, yKey, data: chartData } = spec;

  const commonAxisProps = {
    tick: { fontSize: 10, fill: "var(--cm-text-tertiary, #94a3b8)" },
    axisLine: { stroke: "var(--cm-border-subtle, #e2e8f0)" },
    tickLine: false,
  };

  switch (chartType) {
    case "bar":
      return (
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cm-border-subtle, #e2e8f0)" />
          <XAxis dataKey={xKey} {...commonAxisProps} />
          <YAxis {...commonAxisProps} width={40} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey={yKey} fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
        </BarChart>
      );

    case "line":
      return (
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cm-border-subtle, #e2e8f0)" />
          <XAxis dataKey={xKey} {...commonAxisProps} />
          <YAxis {...commonAxisProps} width={40} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey={yKey} stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      );

    case "area":
      return (
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cm-border-subtle, #e2e8f0)" />
          <XAxis dataKey={xKey} {...commonAxisProps} />
          <YAxis {...commonAxisProps} width={40} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey={yKey} stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.2} />
        </AreaChart>
      );

    case "scatter":
      return (
        <ScatterChart margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cm-border-subtle, #e2e8f0)" />
          <XAxis dataKey={xKey} name={xKey} {...commonAxisProps} />
          <YAxis dataKey={yKey} name={yKey} {...commonAxisProps} width={40} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={chartData} fill={CHART_COLORS[0]} />
        </ScatterChart>
      );

    case "pie":
      return (
        <PieChart>
          <Pie
            data={chartData}
            dataKey={yKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={({ name, percent }) =>
              `${String(name).length > 12 ? String(name).slice(0, 12) + "…" : name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={{ strokeWidth: 1 }}
            style={{ fontSize: 10 }}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      );

    default:
      return (
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cm-border-subtle, #e2e8f0)" />
          <XAxis dataKey={xKey} {...commonAxisProps} />
          <YAxis {...commonAxisProps} width={40} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar dataKey={yKey} fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
        </BarChart>
      );
  }
}

const ACTION_ICONS: Record<string, string> = {
  parseDate: "Calendar",
  fillNulls: "Fill missing values",
  normalizeString: "Standardize text",
  castType: "Convert type",
  deduplicateRows: "Remove duplicates",
  convertUnit: "Convert units",
};

function CleaningPlanResult({ data }: { data: Record<string, unknown> }) {
  const actions = data.actions as Array<{
    column: string;
    action: string;
    params?: Record<string, unknown>;
    reason: string;
  }> | undefined;
  const summary = data.summary as string | undefined;
  const actionCount = (data.actionCount as number) ?? actions?.length ?? 0;
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!actions?.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        No cleaning actions needed — data looks good.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-cm-border-subtle bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100">
            <Wand2 className="h-3.5 w-3.5 text-amber-700" />
          </div>
          <div>
            <p className="text-xs font-semibold text-cm-text-primary">
              Cleaning Plan
            </p>
            <p className="text-[10px] text-cm-text-tertiary">
              {actionCount} action{actionCount !== 1 ? "s" : ""} proposed
            </p>
          </div>
        </div>
        {summary && (
          <span className="max-w-[180px] truncate rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-cm-text-secondary">
            {summary}
          </span>
        )}
      </div>

      <div className="divide-y divide-cm-border-subtle">
        {actions.map((action, i) => {
          const isExpanded = expandedIdx === i;
          const actionLabel = ACTION_ICONS[action.action] ?? action.action.replace(/([A-Z])/g, " $1").trim();

          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-cm-bg-elevated/50 transition-colors"
              >
                {isExpanded
                  ? <ChevronDown className="h-3 w-3 text-cm-text-tertiary shrink-0" />
                  : <ChevronRight className="h-3 w-3 text-cm-text-tertiary shrink-0" />}

                <div className="flex h-5 w-5 items-center justify-center rounded bg-amber-100 shrink-0">
                  <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-medium text-cm-text-primary">
                      {action.column}
                    </span>
                    <span className="rounded bg-cm-bg-elevated px-1.5 py-0.5 text-[10px] text-cm-text-tertiary capitalize">
                      {actionLabel}
                    </span>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="bg-cm-bg-elevated/40 px-3 pb-2.5 pl-10 space-y-1.5">
                  <p className="text-[11px] text-cm-text-secondary leading-relaxed">
                    {action.reason}
                  </p>
                  {action.params && Object.keys(action.params).length > 0 && (
                    <div className="rounded-md border border-cm-border-subtle bg-cm-bg-surface p-2">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-cm-text-tertiary mb-1">
                        Parameters
                      </p>
                      <div className="space-y-0.5">
                        {Object.entries(action.params).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2 text-[10px]">
                            <span className="font-mono text-cm-text-tertiary">{key}:</span>
                            <span className="text-cm-text-primary">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GenericResult({ data }: { data: Record<string, unknown> }) {
  const success = data.success as boolean | undefined;

  if (success !== undefined) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-lg border p-2.5 text-xs",
        success
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      )}>
        {success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
        {success ? "Completed" : String(data.error ?? "Failed")}
      </div>
    );
  }

  return (
    <div className="rounded-md bg-cm-bg-elevated p-2 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
      {JSON.stringify(data, null, 2)}
    </div>
  );
}
