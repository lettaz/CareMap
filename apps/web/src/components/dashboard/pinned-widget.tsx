import { X } from "lucide-react";
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

export function PinnedWidgetCard({ widget }: { widget: PinnedWidgetType }) {
  const { projectId } = useActiveProject();
  const unpinWidget = useDashboardStore((s) => s.unpinWidget);

  return (
    <div className="rounded-lg border border-cm-border-subtle bg-cm-bg-surface">
      <div className="flex items-center justify-between border-b border-cm-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-cm-text-primary">{widget.title}</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => projectId && unpinWidget(projectId, widget.id)}
          aria-label="Unpin widget"
        >
          <X className="size-4 text-cm-text-tertiary" />
        </Button>
      </div>
      <div className="p-4">
        <WidgetChart chartSpec={widget.chartSpec} />
        <p className="mt-2 text-xs italic text-cm-text-tertiary">&ldquo;{widget.queryText}&rdquo;</p>
      </div>
    </div>
  );
}
