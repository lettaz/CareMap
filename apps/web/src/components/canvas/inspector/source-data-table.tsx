import { useState, useCallback, useRef, useEffect } from "react";
import type { SourcePreview, SourcePreviewColumn } from "@/lib/types";
import { ColumnHeaderPopover } from "./column-header-popover";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { usePagination } from "@/hooks/use-pagination";
import { fetchSampleRows } from "@/lib/api/ingest";
import { cn } from "@/lib/utils";

interface SourceDataTableProps {
  preview: SourcePreview;
  showIssuesOnly: boolean;
}

const ROW_HEIGHT_PX = 28;
const HEADER_HEIGHT_PX = 36;
const PAGINATION_HEIGHT_PX = 36;
const MIN_PAGE_SIZE = 10;
const FALLBACK_PAGE_SIZE = 20;

const TYPE_PILLS: Record<string, { label: string; className: string }> = {
  string: { label: "abc", className: "bg-blue-50 text-blue-600" },
  number: { label: "123", className: "bg-emerald-50 text-emerald-600" },
  date: { label: "date", className: "bg-violet-50 text-violet-600" },
  code: { label: "code", className: "bg-amber-50 text-amber-600" },
};

function getQualityDot(col: SourcePreviewColumn, totalRows: number): string {
  const nullRate = col.nullCount / totalRows;
  if (nullRate > 0.3) return "bg-cm-error";
  if (nullRate > 0.1) return "bg-cm-warning";
  return "bg-cm-success";
}

function hasIssue(col: SourcePreviewColumn, totalRows: number): boolean {
  return col.nullCount / totalRows > 0.1;
}

function computePageSize(containerHeight: number): number {
  const available = containerHeight - HEADER_HEIGHT_PX - PAGINATION_HEIGHT_PX;
  const rows = Math.floor(available / ROW_HEIGHT_PX);
  return Math.max(MIN_PAGE_SIZE, rows);
}

export function SourceDataTable({ preview, showIssuesOnly }: SourceDataTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dynamicPageSize, setDynamicPageSize] = useState(FALLBACK_PAGE_SIZE);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [fetchedRows, setFetchedRows] = useState<Record<string, string | number | null>[] | null>(null);
  const [currentSourceFileId, setCurrentSourceFileId] = useState(preview.sourceFileId);
  const pg = usePagination(preview.totalRows, { defaultPageSize: dynamicPageSize });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const height = el.clientHeight;
      if (height > 0) {
        const newSize = computePageSize(height);
        setDynamicPageSize(newSize);
        pg.setPageSize(newSize);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (currentSourceFileId !== preview.sourceFileId) {
    setCurrentSourceFileId(preview.sourceFileId);
    setFetchedRows(null);
    pg.resetPage();
  }

  const rows = fetchedRows ?? preview.rows;

  const loadPage = useCallback(
    (page: number) => {
      if (!preview.sourceFileId) return;
      pg.setPage(page);
      fetchSampleRows(preview.sourceFileId, { page, pageSize: pg.pageSize })
        .then((res) => setFetchedRows(res.data as Record<string, string | number | null>[]))
        .catch(() => {});
    },
    [preview.sourceFileId, pg],
  );

  const visibleColumns = showIssuesOnly
    ? preview.columns.filter((c) => hasIssue(c, preview.totalRows))
    : preview.columns;

  const columnNames = visibleColumns.map((c) => c.name);
  const rowOffset = (pg.page - 1) * pg.pageSize;

  return (
    <div ref={containerRef} className="min-w-0 flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-cm-bg-elevated">
              <th className="w-10 border-b border-r border-cm-border-primary px-2 py-2 text-left text-[10px] font-medium text-cm-text-tertiary">
                #
              </th>
              {visibleColumns.map((col) => {
                const pill = TYPE_PILLS[col.type] ?? TYPE_PILLS.string;
                const dotColor = getQualityDot(col, preview.totalRows);

                return (
                  <th
                    key={col.name}
                    className="relative border-b border-r border-cm-border-primary px-2 py-1.5 text-left"
                  >
                    <button
                      className="flex w-full flex-col gap-0.5 text-left hover:bg-cm-bg-hover rounded px-1 py-0.5 -mx-1 transition-colors"
                      onClick={() =>
                        setActiveColumn(activeColumn === col.name ? null : col.name)
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={cn("block h-1.5 w-1.5 rounded-full shrink-0", dotColor)} />
                        <span className="font-mono text-[11px] font-medium text-cm-text-primary truncate">
                          {col.name}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "inline-block rounded px-1 py-px text-[9px] font-medium leading-tight w-fit",
                          pill.className
                        )}
                      >
                        {pill.label}
                      </span>
                    </button>

                    {activeColumn === col.name && (
                      <ColumnHeaderPopover
                        column={col}
                        totalRows={preview.totalRows}
                        onClose={() => setActiveColumn(null)}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={cn(
                  "border-b border-cm-border-subtle transition-colors hover:bg-cm-bg-elevated/50",
                  rowIdx % 2 === 0 ? "bg-white" : "bg-cm-bg-app"
                )}
              >
                <td className="border-r border-cm-border-subtle px-2 py-1.5 text-[10px] text-cm-text-tertiary tabular-nums text-right">
                  {rowOffset + rowIdx + 1}
                </td>
                {columnNames.map((colName) => {
                  const value = row[colName];
                  const isNull = value === null || value === undefined || value === "";

                  return (
                    <td
                      key={colName}
                      className={cn(
                        "border-r border-cm-border-subtle px-2 py-1.5 font-mono text-[11px] max-w-[140px] truncate",
                        isNull
                          ? "text-cm-text-tertiary italic"
                          : "text-cm-text-primary"
                      )}
                      title={isNull ? "NULL" : String(value)}
                    >
                      {isNull ? "NULL" : String(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={pg.page}
        totalPages={pg.totalPages}
        total={preview.totalRows}
        pageSize={pg.pageSize}
        hasNext={pg.hasNext}
        hasPrev={pg.hasPrev}
        onNext={() => loadPage(pg.page + 1)}
        onPrev={() => loadPage(pg.page - 1)}
        compact
        className="sticky bottom-0 border-t border-cm-border-primary bg-cm-bg-elevated"
      />
    </div>
  );
}
