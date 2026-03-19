import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { Table2, BarChart3, FileText, Plus, Pin, Check } from "lucide-react";
import type { ArtifactTab, ChartSpec } from "@/lib/types";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { cn } from "@/lib/utils";

const TAB_ICONS = {
  overview: FileText,
  table: Table2,
  chart: BarChart3,
} as const;

interface ArtifactTabsProps {
  tabs: ArtifactTab[];
  queryText?: string;
}

export function ArtifactTabs({ tabs, queryText }: ArtifactTabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const active = tabs.find((t) => t.id === activeId);

  return (
    <div className="rounded-lg border border-cm-border-primary bg-white overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-cm-border-primary px-2 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.type];
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "flex items-center gap-1.5 shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                isActive
                  ? "border-cm-accent text-cm-accent"
                  : "border-transparent text-cm-text-tertiary hover:text-cm-text-secondary"
              )}
            >
              <Icon className="h-3 w-3" />
              {tab.hash && (
                <span className={cn("font-mono text-[10px]", isActive ? "text-cm-accent" : "text-cm-text-tertiary")}>
                  {tab.hash}
                </span>
              )}
              <span className="truncate max-w-[160px]">{tab.label}</span>
            </button>
          );
        })}
        <button className="flex items-center justify-center h-6 w-6 shrink-0 rounded text-cm-text-tertiary hover:bg-cm-bg-elevated hover:text-cm-text-secondary transition-colors ml-0.5">
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Tab content */}
      <div className="p-3">
        {active?.type === "overview" && active.content && (
          <OverviewContent content={active.content} />
        )}
        {active?.type === "table" && active.tableData && (
          <TableContent columns={active.tableData.columns} rows={active.tableData.rows} />
        )}
        {active?.type === "chart" && active.chartSpec && (
          <ChartContent spec={active.chartSpec} queryText={queryText} />
        )}
      </div>
    </div>
  );
}

function OverviewContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5 text-xs text-cm-text-primary leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const text = line.slice(2);
          const formatted = text.replace(
            /\*\*(.+?)\*\*/g,
            '<strong class="font-semibold">$1</strong>'
          );
          return (
            <div key={i} className="flex gap-2">
              <span className="text-cm-text-tertiary mt-0.5 shrink-0">&#8226;</span>
              <span dangerouslySetInnerHTML={{ __html: formatted }} />
            </div>
          );
        }
        const formatted = line.replace(
          /\*\*(.+?)\*\*/g,
          '<strong class="font-semibold">$1</strong>'
        );
        return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
      })}
    </div>
  );
}

function TableContent({ columns, rows }: { columns: string[]; rows: (string | number | null)[][] }) {
  return (
    <div className="overflow-auto max-h-[280px] rounded border border-cm-border-subtle">
      <table className="w-full border-collapse text-[11px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-cm-bg-elevated">
            {columns.map((col) => (
              <th
                key={col}
                className="border-b border-r border-cm-border-subtle px-2.5 py-1.5 text-left font-semibold text-cm-text-primary whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-cm-bg-app"}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border-b border-r border-cm-border-subtle px-2.5 py-1.5 text-cm-text-secondary whitespace-nowrap font-mono"
                >
                  {cell ?? <span className="text-cm-text-tertiary italic">null</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartContent({ spec, queryText }: { spec: ChartSpec; queryText?: string }) {
  const { projectId } = useActiveProject();
  const pinWidget = useDashboardStore((s) => s.pinWidget);
  const [pinned, setPinned] = useState(false);
  const chartColor = spec.color ?? "#4F46E5";

  function handlePin() {
    if (!projectId) return;
    pinWidget(projectId, {
      id: `widget-${Date.now()}`,
      title: spec.title,
      queryText: queryText ?? spec.title,
      sqlQuery: "",
      chartSpec: spec,
      pinnedAt: new Date().toISOString(),
    });
    setPinned(true);
    setTimeout(() => setPinned(false), 3000);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-cm-text-primary">{spec.title}</p>
        <button
          type="button"
          onClick={handlePin}
          disabled={pinned}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
            pinned
              ? "bg-cm-success-subtle text-cm-success"
              : "bg-cm-accent-subtle text-cm-accent hover:bg-cm-accent-muted",
          )}
        >
          {pinned ? (
            <>
              <Check className="h-3 w-3" />
              Pinned
            </>
          ) : (
            <>
              <Pin className="h-3 w-3" />
              Pin to Dashboard
            </>
          )}
        </button>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === "line" ? (
            <LineChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey={spec.xKey} tick={{ fontSize: 10 }} stroke="#94A3B8" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #E2E8F0" }} />
              <Line type="monotone" dataKey={spec.yKey} stroke={chartColor} strokeWidth={2} dot={{ r: 3, fill: chartColor }} />
            </LineChart>
          ) : (
            <BarChart data={spec.data} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94A3B8" />
              <YAxis type="category" dataKey={spec.xKey} tick={{ fontSize: 10 }} stroke="#94A3B8" width={55} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #E2E8F0" }} />
              <Bar dataKey={spec.yKey} fill={chartColor} radius={[0, 3, 3, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
