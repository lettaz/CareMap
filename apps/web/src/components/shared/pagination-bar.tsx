import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  onPageSizeChange?: (size: number) => void;
  compact?: boolean;
  className?: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  hasNext,
  hasPrev,
  onNext,
  onPrev,
  onPageSizeChange,
  compact = false,
  className,
}: PaginationBarProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  if (compact) {
    return (
      <div className={cn("flex items-center justify-between px-3 py-1.5 text-[10px] text-cm-text-tertiary", className)}>
        <span>
          {from}–{to} of {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={!hasPrev} onClick={onPrev}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="tabular-nums">
            {page}/{totalPages}
          </span>
          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={!hasNext} onClick={onNext}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between border-t border-cm-border-primary px-4 py-2", className)}>
      <span className="text-xs text-cm-text-tertiary">
        Showing {from}–{to} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 rounded border border-cm-border-primary bg-cm-bg-surface px-2 text-xs text-cm-text-secondary outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={!hasPrev} onClick={onPrev}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-cm-text-secondary">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={!hasNext} onClick={onNext}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
