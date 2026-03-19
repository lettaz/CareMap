import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ExecutionDetails as ExecutionDetailsType } from "@/lib/types";

interface ExecutionDetailsProps {
  details: ExecutionDetailsType;
}

export function ExecutionDetails({ details }: ExecutionDetailsProps) {
  return (
    <Collapsible className="mt-1.5 rounded-md border border-cm-border-primary bg-cm-bg-elevated">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-xs text-cm-text-secondary hover:text-cm-text-primary">
        <span>View query</span>
        <span className="flex items-center gap-1.5">
          <span className="tabular-nums">{details.executionTimeMs}ms</span>
          <ChevronDown className="size-3.5 transition-transform [[data-panel-open]_&]:rotate-180" />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-cm-border-primary px-3 pb-3 pt-2">
        <pre className="mb-2 overflow-x-auto rounded-md bg-cm-bg-elevated p-2 font-mono text-xs leading-relaxed text-cm-text-primary">
          {details.sql}
        </pre>

        <div className="flex flex-wrap gap-1">
          {details.tablesUsed.map((table) => (
            <span
              key={table}
              className="rounded-full border border-cm-border-primary bg-white px-2 py-0.5 font-mono text-[10px] text-cm-text-secondary"
            >
              {table}
            </span>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3 text-[10px] text-cm-text-tertiary">
          <span>{details.rowCount} rows</span>
          <span>Fresh: {new Date(details.dataFreshness).toLocaleDateString()}</span>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
