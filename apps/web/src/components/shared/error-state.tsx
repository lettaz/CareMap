import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ message, onRetry, compact }: ErrorStateProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-cm-error/20 bg-cm-error-subtle px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-cm-error" />
        <span className="flex-1 text-xs text-cm-error">{message}</span>
        {onRetry && (
          <button onClick={onRetry} className="text-xs font-medium text-cm-error underline">
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cm-error-subtle">
        <AlertTriangle className="h-5 w-5 text-cm-error" />
      </div>
      <p className="mt-3 text-sm font-medium text-cm-text-primary">Failed to load</p>
      <p className="mt-1 max-w-sm text-xs text-cm-text-secondary">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
