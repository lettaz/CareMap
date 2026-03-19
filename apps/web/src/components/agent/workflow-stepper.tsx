import { cn } from "@/lib/utils";

interface WorkflowStepperProps {
  steps: string[];
  currentIndex: number;
  color: string;
}

export function WorkflowStepper({
  steps,
  currentIndex,
  color,
}: WorkflowStepperProps) {
  return (
    <div className="flex items-center justify-between px-2 py-3">
      {steps.map((step, i) => {
        const isPast = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "size-2.5 rounded-full transition-colors",
                  isFuture && "border border-cm-border-primary bg-transparent",
                  (isPast || isCurrent) && "border-transparent"
                )}
                style={
                  isPast || isCurrent ? { backgroundColor: color } : undefined
                }
              />
              <span
                className={cn(
                  "max-w-[60px] truncate text-center text-[10px] leading-tight",
                  isCurrent && "font-semibold text-cm-text-primary",
                  isPast && "text-cm-text-secondary",
                  isFuture && "text-cm-text-tertiary"
                )}
              >
                {step}
              </span>
            </div>

            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mx-1 mt-[-12px] h-px w-6",
                  isFuture ? "bg-cm-border-primary" : ""
                )}
                style={!isFuture ? { backgroundColor: color } : undefined}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
