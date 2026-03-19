import { Database } from "lucide-react";
import type { ScanDetails } from "@/lib/types";

interface ScanCardProps {
  details: ScanDetails;
}

export function ScanCard({ details }: ScanCardProps) {
  return (
    <div className="rounded-lg border border-cm-border-primary bg-cm-bg-elevated p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5">
        <Database className="size-3.5 text-cm-text-secondary" />
        <p className="text-xs font-semibold text-cm-text-primary">Data Scan</p>
      </div>

      <div className="space-y-2">
        <TagSection label="Tables" items={details.tables} />
        <TagSection label="Joins" items={details.joinConditions} />
        <TagSection label="Filters" items={details.filters} />
      </div>
    </div>
  );
}

function TagSection({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-cm-text-tertiary">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className="inline-block rounded-full border border-cm-border-primary bg-white px-2 py-0.5 font-mono text-[10px] text-cm-text-secondary"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
