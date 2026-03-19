import { useState } from "react";
import { X, RefreshCw, Clock, Pencil, Check } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { PinnedWidget as PinnedWidgetType } from "@/lib/types";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function WidgetChart({ chartSpec }: { chartSpec: PinnedWidgetType["chartSpec"] }) {
  const { type, data, xKey, yKey, color = "#6366f1" } = chartSpec;

  return (
    <ResponsiveContainer width="100%" height={200}>
      {type === "bar" ? (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      ) : (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

function formatRefreshedAt(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function PinnedWidgetCard({ widget }: { widget: PinnedWidgetType }) {
  const { projectId } = useActiveProject();
  const unpinWidget = useDashboardStore((s) => s.unpinWidget);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(widget.title);
  const [refreshing, setRefreshing] = useState(false);

  const lastRefreshed = widget.lastRefreshedAt ?? widget.pinnedAt;

  function handleSaveTitle() {
    setIsEditing(false);
    // When backend is connected, call an API to update the widget title
  }

  function handleRefresh() {
    setRefreshing(true);
    // When backend is connected, re-run widget.sqlQuery and update chartSpec
    setTimeout(() => setRefreshing(false), 1500);
  }

  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface shadow-[var(--cm-shadow-surface)] transition-shadow hover:shadow-[var(--cm-shadow-elevated)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cm-border-primary px-4 py-3">
        <div className="mr-2 min-w-0 flex-1">
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                onBlur={handleSaveTitle}
                autoFocus
                className="w-full rounded border border-cm-accent bg-cm-bg-app px-2 py-0.5 text-sm font-semibold text-cm-text-primary outline-none"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="shrink-0 text-cm-success"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="group flex items-center gap-1.5 text-left"
            >
              <h3 className="truncate text-sm font-semibold text-cm-text-primary">
                {editTitle}
              </h3>
              <Pencil className="h-3 w-3 shrink-0 text-cm-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            aria-label="Refresh widget"
            disabled={refreshing}
          >
            <RefreshCw
              className={cn(
                "size-3.5 text-cm-text-tertiary",
                refreshing && "animate-spin",
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => projectId && unpinWidget(projectId, widget.id)}
            aria-label="Unpin widget"
          >
            <X className="size-3.5 text-cm-text-tertiary" />
          </Button>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <WidgetChart chartSpec={widget.chartSpec} />

        {/* Footer: query + refresh timestamp */}
        <div className="mt-3 flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 text-xs italic text-cm-text-tertiary">
            &ldquo;{widget.queryText}&rdquo;
          </p>
          <span className="flex shrink-0 items-center gap-1 text-xs text-cm-text-tertiary">
            <Clock className="h-3 w-3" />
            {formatRefreshedAt(lastRefreshed)}
          </span>
        </div>
      </div>
    </div>
  );
}
