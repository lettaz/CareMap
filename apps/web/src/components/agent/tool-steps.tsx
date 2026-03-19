import { useState } from "react";
import {
  Search,
  Pencil,
  BarChart3,
  Table2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  XCircle,
} from "lucide-react";
import { EntityPill } from "./entity-pill";
import type { ToolStep, ToolStepStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEP_ICONS = {
  search: Search,
  edit: Pencil,
  chart: BarChart3,
  table: Table2,
  check: CheckCircle2,
} as const;

const STATUS_CONFIG: Record<ToolStepStatus, { icon: typeof Loader2; color: string; label: string }> = {
  running: { icon: Loader2, color: "text-cm-accent", label: "Running" },
  success: { icon: CheckCircle2, color: "text-emerald-500", label: "Success" },
  error: { icon: XCircle, color: "text-red-500", label: "Error" },
};

interface ToolStepsProps {
  steps: ToolStep[];
}

export function ToolSteps({ steps }: ToolStepsProps) {
  return (
    <div className="rounded-lg border border-cm-border-primary bg-white overflow-hidden">
      {steps.map((step, idx) => (
        <ToolStepRow key={step.id} step={step} isLast={idx === steps.length - 1} />
      ))}
    </div>
  );
}

function ToolStepRow({ step, isLast }: { step: ToolStep; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const StepIcon = STEP_ICONS[step.icon];
  const statusCfg = STATUS_CONFIG[step.status];
  const StatusIcon = statusCfg.icon;
  const hasDetail = !!step.detail;

  return (
    <div className={cn(!isLast && "border-b border-cm-border-subtle")}>
      <button
        onClick={() => hasDetail && setExpanded((p) => !p)}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
          hasDetail && "hover:bg-cm-bg-elevated/50 cursor-pointer",
          !hasDetail && "cursor-default",
        )}
      >
        <StepIcon className="h-3.5 w-3.5 text-cm-text-tertiary shrink-0" />

        <span className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-cm-text-primary truncate">{step.label}</span>
          {step.entities?.map((e) => (
            <EntityPill key={e.id} entity={e} />
          ))}
        </span>

        <span className={cn("flex items-center gap-1 shrink-0 text-[11px] font-medium", statusCfg.color)}>
          <StatusIcon className={cn("h-3.5 w-3.5", step.status === "running" && "animate-spin")} />
          {step.status !== "running" && step.durationMs !== undefined && (
            <span>{statusCfg.label} ({(step.durationMs / 1000).toFixed(2)}s)</span>
          )}
        </span>

        {hasDetail && (
          expanded
            ? <ChevronDown className="h-3 w-3 text-cm-text-tertiary shrink-0" />
            : <ChevronRight className="h-3 w-3 text-cm-text-tertiary shrink-0" />
        )}
      </button>

      {expanded && step.detail && (
        <div className="px-3 pb-2.5 pt-0">
          <pre className="rounded bg-cm-bg-app border border-cm-border-subtle px-3 py-2 text-[11px] text-cm-text-secondary font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
            {step.detail}
          </pre>
        </div>
      )}
    </div>
  );
}
