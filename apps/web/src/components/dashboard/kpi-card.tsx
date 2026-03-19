import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  /** Override whether the trend direction is positive (green) or negative (red) */
  trendPositive?: boolean;
}

const TREND_ICON = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const;

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-cm-accent",
  trend,
  trendValue,
  trendPositive,
}: KpiCardProps) {
  const TrendIcon = trend ? TREND_ICON[trend] : null;

  const isPositive = trendPositive ?? (trend === "up");
  const trendColor =
    trend === "flat"
      ? "text-cm-text-tertiary"
      : isPositive
        ? "text-cm-success"
        : "text-cm-error";

  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface p-4 shadow-[var(--cm-shadow-surface)] transition-shadow hover:shadow-[var(--cm-shadow-elevated)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-cm-text-tertiary">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", iconColor)} />}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-cm-text-primary">
        {value}
      </p>
      {TrendIcon && trendValue && (
        <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium", trendColor)}>
          <TrendIcon className="h-3 w-3" />
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}
