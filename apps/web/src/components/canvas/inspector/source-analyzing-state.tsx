import { Loader2, FileSpreadsheet } from "lucide-react";

interface AnalysisStepData {
  label: string;
  status: "pending" | "running" | "completed" | "error" | "failed";
}

interface SourceAnalyzingStateProps {
  filename: string;
  fileSize: string;
  steps?: AnalysisStepData[];
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-cm-bg-elevated ${className ?? ""}`} />
  );
}

const DEFAULT_STEPS: AnalysisStepData[] = [
  { label: "Reading file structure", status: "running" },
  { label: "Detecting column types", status: "pending" },
  { label: "Profiling data quality", status: "pending" },
  { label: "Generating AI insights", status: "pending" },
];

export function SourceAnalyzingState({ filename, fileSize, steps }: SourceAnalyzingStateProps) {
  const displaySteps = steps?.length ? steps : DEFAULT_STEPS;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      <div className="flex items-center gap-3 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cm-accent-subtle">
          <FileSpreadsheet className="h-5 w-5 text-cm-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-cm-text-primary truncate">{filename}</p>
          <p className="text-xs text-cm-text-tertiary">{fileSize}</p>
        </div>
        <Loader2 className="h-4 w-4 animate-spin text-cm-accent" />
      </div>

      <div className="space-y-3">
        {displaySteps.map((step) => (
          <AnalysisStep key={step.label} label={step.label} status={step.status} />
        ))}
      </div>

      <div className="space-y-2 pt-2">
        <p className="text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide">
          Preview loading...
        </p>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Shimmer key={i} className="h-6 flex-1" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-2" style={{ opacity: 1 - i * 0.12 }}>
            {Array.from({ length: 5 }).map((_, j) => (
              <Shimmer key={j} className="h-5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisStep({
  label,
  status,
}: {
  label: string;
  status: "pending" | "running" | "completed" | "error" | "failed";
}) {
  return (
    <div className="flex items-center gap-3">
      {status === "completed" && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cm-success-subtle">
          <svg className="h-3 w-3 text-cm-success" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      {status === "running" && (
        <div className="flex h-5 w-5 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-cm-accent" />
        </div>
      )}
      {(status === "error" || status === "failed") && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100">
          <span className="text-xs text-amber-600">!</span>
        </div>
      )}
      {status === "pending" && (
        <div className="h-5 w-5 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-cm-bg-elevated" />
        </div>
      )}
      <span
        className={`text-xs ${
          status === "completed"
            ? "text-cm-text-secondary"
            : status === "running"
              ? "text-cm-text-primary font-medium"
              : status === "error" || status === "failed"
                ? "text-amber-600"
                : "text-cm-text-tertiary"
        }`}
      >
        {label}{status === "failed" ? " (skipped)" : ""}
      </span>
    </div>
  );
}
