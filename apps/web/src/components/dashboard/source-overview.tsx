import { MOCK_SOURCES } from "@/lib/mock-data";
import { StatusDot } from "@/components/shared/status-dot";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SourceOverview() {
  return (
    <div className="rounded-lg border border-cm-border-subtle bg-cm-bg-surface">
      <div className="border-b border-cm-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-cm-text-primary">Data Sources</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cm-border-subtle text-left text-xs font-medium text-cm-text-tertiary">
              <th className="px-4 py-2">File</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2 text-right">Rows</th>
              <th className="px-4 py-2 text-right">Columns</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_SOURCES.map((src) => (
              <tr
                key={src.id}
                className="border-b border-cm-border-subtle last:border-b-0 hover:bg-cm-bg-elevated"
              >
                <td className="px-4 py-2 font-medium text-cm-text-primary">
                  {src.filename}
                </td>
                <td className="px-4 py-2 uppercase text-cm-text-secondary">
                  {src.fileType}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-cm-text-secondary">
                  {src.rowCount.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-cm-text-secondary">
                  {src.columnCount}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <StatusDot status={src.status} />
                    <span className="capitalize text-cm-text-secondary">{src.status}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-cm-text-tertiary">
                  {formatDate(src.uploadedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
