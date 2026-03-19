import { Fragment, useState } from "react";
import { cn } from "@/lib/utils";
import type { CompletenessData } from "@/lib/types";

/**
 * Design spec color thresholds:
 *  >95%  → green  (#D1FAE5 bg / emerald-800 text)
 *  80-95 → amber  (#FEF3C7 bg / amber-800 text)
 *  <80%  → red    (#FEE2E2 bg / red-800 text)
 */
function getCellStyle(pct: number): { bg: string; text: string } {
  if (pct >= 95) return { bg: "bg-[#D1FAE5]", text: "text-emerald-800" };
  if (pct >= 80) return { bg: "bg-[#FEF3C7]", text: "text-amber-800" };
  return { bg: "bg-[#FEE2E2]", text: "text-red-800" };
}

function getSeverityLabel(pct: number): string {
  if (pct >= 95) return "Good";
  if (pct >= 80) return "Needs attention";
  return "Critical gap";
}

interface CompletenessHeatmapProps {
  data: CompletenessData | null;
}

export function CompletenessHeatmap({ data }: CompletenessHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ field: string; bucket: string } | null>(null);

  if (!data || data.fields.length === 0) {
    return (
      <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface shadow-[var(--cm-shadow-surface)]">
        <div className="border-b border-cm-border-primary px-5 py-3.5">
          <h3 className="text-[0.9375rem] font-semibold text-cm-text-primary">
            Field Completeness
          </h3>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-cm-text-tertiary">
            No completeness data available yet. Harmonize data to see field coverage.
          </p>
        </div>
      </div>
    );
  }

  const { fields, buckets, values } = data;

  const fieldAverages = fields.map((field) => {
    const row = values[field];
    if (!row) return 0;
    const vals = buckets.map((b) => row[b] ?? 0);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  });

  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface shadow-[var(--cm-shadow-surface)]">
      <div className="border-b border-cm-border-primary px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[0.9375rem] font-semibold text-cm-text-primary">
              Field Completeness by Ward
            </h3>
            <p className="mt-0.5 text-xs text-cm-text-tertiary">
              Per-field fill rates across {buckets.length} wards
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#D1FAE5]" />
              <span className="text-xs text-cm-text-tertiary">&ge;95%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#FEF3C7]" />
              <span className="text-xs text-cm-text-tertiary">80–94%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-[#FEE2E2]" />
              <span className="text-xs text-cm-text-tertiary">&lt;80%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-4">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `minmax(9rem, auto) repeat(${buckets.length}, 1fr) 3.5rem`,
          }}
        >
          {/* Column headers */}
          <div className="sticky top-0 z-10 bg-cm-bg-surface" />
          {buckets.map((bucket) => (
            <div
              key={bucket}
              className="sticky top-0 z-10 bg-cm-bg-surface pb-1 text-center text-xs font-semibold text-cm-text-secondary"
            >
              {bucket}
            </div>
          ))}
          <div className="sticky top-0 z-10 bg-cm-bg-surface pb-1 text-center text-xs font-semibold text-cm-text-tertiary">
            Avg
          </div>

          {/* Rows */}
          {fields.map((field, fi) => {
            const row = values[field] ?? {};
            const avg = fieldAverages[fi];
            const avgStyle = getCellStyle(avg);

            return (
              <Fragment key={field}>
                <div className="flex items-center pr-3 text-xs text-cm-text-secondary">
                  <span className="truncate font-mono font-medium">{field}</span>
                </div>

                {buckets.map((bucket) => {
                  const pct = row[bucket] ?? 0;
                  const style = getCellStyle(pct);
                  const isHovered =
                    hoveredCell?.field === field && hoveredCell?.bucket === bucket;

                  return (
                    <div
                      key={`${field}-${bucket}`}
                      className="relative"
                      onMouseEnter={() => setHoveredCell({ field, bucket })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div
                        className={cn(
                          "flex cursor-default items-center justify-center rounded px-1 py-1.5 text-xs font-medium tabular-nums transition-shadow",
                          style.bg,
                          style.text,
                          isHovered && "ring-2 ring-cm-accent/40",
                        )}
                      >
                        {pct}%
                      </div>

                      {/* Tooltip */}
                      {isHovered && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
                          <div className="whitespace-nowrap rounded-md bg-cm-text-primary px-3 py-2 text-xs text-white shadow-lg">
                            <p className="font-semibold">
                              {field} — Ward {bucket}
                            </p>
                            <p className="mt-0.5 tabular-nums">
                              Fill rate: {pct}% · {getSeverityLabel(pct)}
                            </p>
                          </div>
                          <div className="mx-auto h-0 w-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-cm-text-primary" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Row average */}
                <div
                  className={cn(
                    "flex items-center justify-center rounded px-1 py-1.5 text-xs font-semibold tabular-nums",
                    avgStyle.bg,
                    avgStyle.text,
                  )}
                >
                  {avg}%
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
