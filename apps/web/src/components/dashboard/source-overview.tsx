import { FileSpreadsheet, FileText, FileType2, File } from "lucide-react";
import type { DashboardSourceSummary } from "@/lib/types";
import { StatusDot } from "@/components/shared/status-dot";
import { cn } from "@/lib/utils";

const FILE_ICON: Record<string, typeof FileText> = {
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  pdf: FileType2,
  txt: FileText,
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface SourceOverviewProps {
  sources: DashboardSourceSummary[];
}

export function SourceOverview({ sources }: SourceOverviewProps) {
  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface shadow-[var(--cm-shadow-surface)]">
      <div className="border-b border-cm-border-primary px-5 py-3.5">
        <h3 className="text-[0.9375rem] font-semibold text-cm-text-primary">
          Data Sources
        </h3>
        <p className="mt-0.5 text-xs text-cm-text-tertiary">
          {sources.length} source{sources.length !== 1 ? "s" : ""} connected
        </p>
      </div>

      {sources.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-cm-text-tertiary">
            No sources connected yet. Upload files via the canvas.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cm-border-primary text-left text-xs font-medium text-cm-text-tertiary">
                <th className="px-5 py-2.5">Source</th>
                <th className="px-4 py-2.5 text-right">Rows</th>
                <th className="px-4 py-2.5 text-right">Mapped</th>
                <th className="px-4 py-2.5 text-right">Unmapped</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Last Sync</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((src, i) => {
                const Icon = FILE_ICON[src.fileType] ?? File;
                const total = src.mappedFields + src.unmappedFields;
                const coverage = total > 0 ? Math.round((src.mappedFields / total) * 100) : 0;

                return (
                  <tr
                    key={src.id}
                    className={cn(
                      "border-b border-cm-border-subtle last:border-b-0 transition-colors hover:bg-cm-bg-elevated",
                      i % 2 === 1 && "bg-cm-bg-app",
                    )}
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0 text-cm-text-tertiary" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-cm-text-primary">
                            {src.filename}
                          </p>
                          <p className="text-xs text-cm-text-tertiary">{src.domain}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-cm-text-secondary">
                      {src.rowCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="tabular-nums text-cm-success">{src.mappedFields}</span>
                      <span className="text-cm-text-tertiary">/{total}</span>
                      <span className="ml-1.5 text-xs text-cm-text-tertiary">
                        ({coverage}%)
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {src.unmappedFields > 0 ? (
                        <span className="tabular-nums text-cm-warning">{src.unmappedFields}</span>
                      ) : (
                        <span className="text-cm-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <StatusDot status={src.status} />
                        <span className="capitalize text-cm-text-secondary">{src.status}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-cm-text-tertiary">
                      {formatRelativeTime(src.lastSyncAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
