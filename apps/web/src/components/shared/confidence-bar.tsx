import { cn } from "@/lib/utils";

function getFillColour(value: number): string {
  if (value >= 0.8) return "bg-emerald-500";
  if (value >= 0.6) return "bg-amber-500";
  return "bg-red-500";
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 1) * 100;

  return (
    <div className="h-1.5 w-full rounded-full bg-cm-bg-elevated">
      <div
        className={cn("h-full rounded-full transition-all", getFillColour(value))}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
