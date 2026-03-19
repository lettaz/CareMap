import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanStep } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  steps: PlanStep[];
  onApprove: () => void;
}

export function PlanCard({ steps, onApprove }: PlanCardProps) {
  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-elevated p-3 shadow-sm">
      <p className="mb-2 text-xs font-semibold text-cm-text-primary">
        Proposed Plan
      </p>

      <ol className="space-y-1.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            {step.completed ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-cm-success" />
            ) : (
              <Circle
                className={cn(
                  "mt-0.5 size-3.5 shrink-0 text-cm-text-tertiary"
                )}
              />
            )}
            <span
              className={cn(
                step.completed
                  ? "text-cm-text-secondary"
                  : "text-cm-text-primary"
              )}
            >
              {i + 1}. {step.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex gap-2">
        <Button
          size="xs"
          onClick={onApprove}
          className="bg-cm-accent text-white hover:bg-cm-accent-hover"
        >
          Approve
        </Button>
        <Button size="xs" variant="outline">
          Edit
        </Button>
      </div>
    </div>
  );
}
