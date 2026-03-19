import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
}

const TREND_CONFIG = {
  up: { icon: TrendingUp, colour: "text-cm-success" },
  down: { icon: TrendingDown, colour: "text-cm-error" },
  flat: { icon: Minus, colour: "text-cm-text-tertiary" },
} as const;

export function KpiCard({ label, value, trend, trendValue }: KpiCardProps) {
  const trendInfo = trend ? TREND_CONFIG[trend] : null;

  return (
    <div className="rounded-lg border border-cm-border-subtle bg-cm-bg-surface p-4">
      <p className="text-xs font-medium text-cm-text-tertiary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-cm-text-primary">{value}</p>
      {trendInfo && trendValue && (
        <div className={cn("mt-1 flex items-center gap-1 text-xs", trendInfo.colour)}>
          <trendInfo.icon className="size-3" />
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}
