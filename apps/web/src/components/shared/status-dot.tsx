import type { NodeStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<NodeStatus, string> = {
  ready: "bg-emerald-500",
  running: "bg-amber-500 animate-pulse",
  warning: "bg-amber-500",
  error: "bg-red-500",
  idle: "bg-slate-300",
};

export function StatusDot({ status }: { status: NodeStatus }) {
  return (
    <span
      className={cn("inline-flex h-2 w-2 rounded-full", STATUS_CLASSES[status])}
      aria-label={status}
    />
  );
}
