import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { GitBranch, FileSpreadsheet, Database } from "lucide-react";
import type { LineageEntry, DashboardSourceSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DataLineageWidgetProps {
  entries: LineageEntry[];
  sources: DashboardSourceSummary[];
}

interface Connection {
  sourceFile: string;
  sourceFileId: string;
  targetTable: string;
  fieldCount: number;
  fields: Array<{ from: string; to: string; transform?: string }>;
}

const FLOW_COLORS = [
  "stroke-cm-node-source",
  "stroke-cm-node-transform",
  "stroke-cm-node-sink",
  "stroke-cm-accent",
  "stroke-cm-warning",
  "stroke-cm-info",
  "stroke-cm-error",
  "stroke-cm-success",
];

function shortName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/_/g, " ");
}

export function DataLineageWidget({ entries, sources }: DataLineageWidgetProps) {
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.id, s.filename])), [sources]);

  const connections = useMemo(() => {
    const map = new Map<string, Connection>();

    for (const entry of entries) {
      const key = `${entry.sourceFileId}::${entry.metricLabel}`;
      const existing = map.get(key);
      const filename = sourceMap.get(entry.sourceFileId) ?? entry.sourceFileId.slice(0, 8);

      if (existing) {
        existing.fieldCount++;
        existing.fields.push({
          from: entry.sourceColumn,
          to: entry.targetField,
          transform: entry.transformations[0],
        });
      } else {
        map.set(key, {
          sourceFile: filename,
          sourceFileId: entry.sourceFileId,
          targetTable: entry.metricLabel,
          fieldCount: 1,
          fields: [{
            from: entry.sourceColumn,
            to: entry.targetField,
            transform: entry.transformations[0],
          }],
        });
      }
    }

    return [...map.values()];
  }, [entries, sourceMap]);

  const uniqueSources = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; totalFields: number }>();
    for (const c of connections) {
      const existing = seen.get(c.sourceFileId);
      if (existing) {
        existing.totalFields += c.fieldCount;
      } else {
        seen.set(c.sourceFileId, {
          id: c.sourceFileId,
          name: c.sourceFile,
          totalFields: c.fieldCount,
        });
      }
    }
    return [...seen.values()].sort((a, b) => b.totalFields - a.totalFields);
  }, [connections]);

  const uniqueTargets = useMemo(() => {
    const seen = new Map<string, { name: string; totalFields: number }>();
    for (const c of connections) {
      const existing = seen.get(c.targetTable);
      if (existing) {
        existing.totalFields += c.fieldCount;
      } else {
        seen.set(c.targetTable, {
          name: c.targetTable,
          totalFields: c.fieldCount,
        });
      }
    }
    return [...seen.values()].sort((a, b) => b.totalFields - a.totalFields);
  }, [connections]);

  const targetColorMap = useMemo(() => {
    const map = new Map<string, string>();
    uniqueTargets.forEach((t, i) => map.set(t.name, FLOW_COLORS[i % FLOW_COLORS.length]));
    return map;
  }, [uniqueTargets]);

  const [highlight, setHighlight] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const targetRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [paths, setPaths] = useState<
    Array<{ d: string; sourceId: string; targetName: string; color: string; fieldCount: number }>
  >([]);

  const computePaths = useCallback(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    const containerRect = container.getBoundingClientRect();
    const newPaths: typeof paths = [];

    for (const conn of connections) {
      const sourceEl = sourceRefs.current.get(conn.sourceFileId);
      const targetEl = targetRefs.current.get(conn.targetTable);
      if (!sourceEl || !targetEl) continue;

      const sRect = sourceEl.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();

      const x1 = sRect.right - containerRect.left;
      const y1 = sRect.top + sRect.height / 2 - containerRect.top;
      const x2 = tRect.left - containerRect.left;
      const y2 = tRect.top + tRect.height / 2 - containerRect.top;

      const cpOffset = Math.min(Math.abs(x2 - x1) * 0.4, 80);

      newPaths.push({
        d: `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`,
        sourceId: conn.sourceFileId,
        targetName: conn.targetTable,
        color: targetColorMap.get(conn.targetTable) ?? FLOW_COLORS[0],
        fieldCount: conn.fieldCount,
      });
    }

    setPaths(newPaths);
  }, [connections, targetColorMap]);

  useEffect(() => {
    const timer = setTimeout(computePaths, 50);
    window.addEventListener("resize", computePaths);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", computePaths);
    };
  }, [computePaths]);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface p-6 text-center shadow-[var(--cm-shadow-surface)]">
        <GitBranch className="mx-auto h-6 w-6 text-cm-text-tertiary" />
        <p className="mt-2 text-sm text-cm-text-tertiary">
          No lineage data available yet.
        </p>
      </div>
    );
  }

  const isHighlighted = (sourceId: string, targetName: string) => {
    if (!highlight) return true;
    return highlight === sourceId || highlight === targetName;
  };

  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface shadow-[var(--cm-shadow-surface)]">
      <div className="border-b border-cm-border-primary px-5 py-3.5">
        <h3 className="text-[0.9375rem] font-semibold text-cm-text-primary">
          Data Lineage
        </h3>
        <p className="mt-0.5 text-xs text-cm-text-tertiary">
          How source files map into harmonized tables
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-x-auto px-5 py-5"
        onMouseLeave={() => setHighlight(null)}
      >
        <svg
          ref={svgRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ zIndex: 1 }}
        >
          {paths.map((p, i) => {
            const active = isHighlighted(p.sourceId, p.targetName);
            return (
              <path
                key={i}
                d={p.d}
                fill="none"
                className={cn(
                  p.color,
                  "transition-opacity duration-200",
                )}
                strokeWidth={Math.min(Math.max(p.fieldCount * 0.5, 1.5), 4)}
                strokeOpacity={active ? 0.35 : 0.06}
              />
            );
          })}
        </svg>

        <div className="relative z-10 flex items-start justify-between gap-8">
          {/* Source files column */}
          <div className="flex w-[42%] shrink-0 flex-col gap-1.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-cm-text-tertiary">
              <FileSpreadsheet className="h-3 w-3" />
              Sources
            </div>
            {uniqueSources.map((src) => (
              <div
                key={src.id}
                ref={(el) => {
                  if (el) sourceRefs.current.set(src.id, el);
                }}
                onMouseEnter={() => setHighlight(src.id)}
                className={cn(
                  "flex cursor-default items-center justify-between rounded-md border px-3 py-2 transition-all duration-200",
                  highlight === src.id
                    ? "border-cm-node-source/40 bg-cm-node-source-subtle shadow-sm"
                    : highlight
                      ? "border-transparent bg-cm-bg-elevated/50 opacity-40"
                      : "border-cm-border-subtle bg-cm-bg-app hover:border-cm-node-source/30 hover:bg-cm-node-source-subtle/50",
                )}
              >
                <span className="truncate text-xs font-medium text-cm-text-primary">
                  {shortName(src.name)}
                </span>
                <span className="ml-2 shrink-0 rounded-full bg-cm-node-source/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-cm-node-source">
                  {src.totalFields}
                </span>
              </div>
            ))}
          </div>

          {/* Target tables column */}
          <div className="flex w-[42%] shrink-0 flex-col gap-1.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-cm-text-tertiary">
              <Database className="h-3 w-3" />
              Harmonized Tables
            </div>
            {uniqueTargets.map((tgt) => (
              <div
                key={tgt.name}
                ref={(el) => {
                  if (el) targetRefs.current.set(tgt.name, el);
                }}
                onMouseEnter={() => setHighlight(tgt.name)}
                className={cn(
                  "flex cursor-default items-center justify-between rounded-md border px-3 py-2 transition-all duration-200",
                  highlight === tgt.name
                    ? "border-cm-node-sink/40 bg-cm-node-sink-subtle shadow-sm"
                    : highlight
                      ? "border-transparent bg-cm-bg-elevated/50 opacity-40"
                      : "border-cm-border-subtle bg-cm-bg-app hover:border-cm-node-sink/30 hover:bg-cm-node-sink-subtle/50",
                )}
              >
                <span className="truncate font-mono text-xs font-medium text-cm-text-primary">
                  {tgt.name}
                </span>
                <span className="ml-2 shrink-0 rounded-full bg-cm-node-sink/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-cm-node-sink">
                  {tgt.totalFields}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
