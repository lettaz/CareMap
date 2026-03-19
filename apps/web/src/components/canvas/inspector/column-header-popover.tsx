import { useEffect, useRef } from "react";
import type { SourcePreviewColumn } from "@/lib/mock-data";

interface ColumnHeaderPopoverProps {
  column: SourcePreviewColumn;
  totalRows: number;
  onClose: () => void;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1 w-full rounded-full bg-cm-bg-elevated">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ColumnHeaderPopover({ column, totalRows, onClose }: ColumnHeaderPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const nullRate = totalRows > 0 ? column.nullCount / totalRows : 0;
  const fillRate = 1 - nullRate;

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-cm-border-primary bg-white shadow-[var(--cm-shadow-elevated)] p-3 space-y-3"
    >
      {/* Column name + type */}
      <div>
        <p className="font-mono text-xs font-semibold text-cm-text-primary">{column.name}</p>
        <p className="text-[10px] text-cm-text-tertiary capitalize">{column.type}</p>
      </div>

      {/* Completeness */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-cm-text-secondary">Completeness</span>
          <span className="font-medium text-cm-text-primary">{Math.round(fillRate * 100)}%</span>
        </div>
        <MiniBar
          value={fillRate}
          max={1}
          color={nullRate > 0.3 ? "bg-cm-error" : nullRate > 0.1 ? "bg-cm-warning" : "bg-cm-success"}
        />
        {column.nullCount > 0 && (
          <p className="text-[10px] text-cm-text-tertiary">
            {column.nullCount} null values ({Math.round(nullRate * 100)}%)
          </p>
        )}
      </div>

      {/* Unique values */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-cm-text-secondary">Unique values</span>
        <span className="font-medium text-cm-text-primary">{column.uniqueCount}</span>
      </div>

      {/* Numeric stats */}
      {column.type === "number" && column.min !== undefined && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-cm-text-tertiary">Min</p>
            <p className="font-mono text-[11px] font-medium text-cm-text-primary">{column.min}</p>
          </div>
          <div>
            <p className="text-[10px] text-cm-text-tertiary">Mean</p>
            <p className="font-mono text-[11px] font-medium text-cm-text-primary">
              {column.mean?.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-cm-text-tertiary">Max</p>
            <p className="font-mono text-[11px] font-medium text-cm-text-primary">{column.max}</p>
          </div>
        </div>
      )}

      {/* Top values for string/code columns */}
      {column.topValues && column.topValues.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-cm-text-secondary">Top values</p>
          <div className="flex flex-wrap gap-1">
            {column.topValues.slice(0, 5).map((v) => (
              <span
                key={v}
                className="rounded bg-cm-bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-cm-text-secondary"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
