import { Fragment } from "react";
import { cn } from "@/lib/utils";

const WARDS = ["A1", "A2", "B1", "B2", "C1"] as const;
const FIELDS = [
  "PatientNr",
  "Sturzrisiko",
  "Mobilität",
  "Ernährung",
  "Schmerz",
  "Dekubitus",
] as const;

const DATA: Record<string, Record<string, number>> = {
  PatientNr:   { A1: 100, A2: 98, B1: 96, B2: 92, C1: 100 },
  Sturzrisiko: { A1: 95,  A2: 88, B1: 91, B2: 74, C1: 97 },
  Mobilität:   { A1: 92,  A2: 85, B1: 88, B2: 71, C1: 94 },
  Ernährung:   { A1: 88,  A2: 82, B1: 79, B2: 68, C1: 90 },
  Schmerz:     { A1: 97,  A2: 91, B1: 93, B2: 78, C1: 96 },
  Dekubitus:   { A1: 90,  A2: 86, B1: 84, B2: 65, C1: 91 },
};

function getCellColour(pct: number): string {
  if (pct >= 90) return "bg-emerald-100 text-emerald-800";
  if (pct >= 80) return "bg-emerald-50 text-emerald-700";
  if (pct >= 70) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export function CompletenessHeatmap() {
  return (
    <div className="rounded-lg border border-cm-border-subtle bg-cm-bg-surface">
      <div className="border-b border-cm-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-cm-text-primary">
          Field Completeness by Ward
        </h3>
      </div>
      <div className="p-4">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `8rem repeat(${WARDS.length}, 1fr)`,
          }}
        >
          <div />
          {WARDS.map((ward) => (
            <div
              key={ward}
              className="text-center text-xs font-medium text-cm-text-tertiary"
            >
              {ward}
            </div>
          ))}

          {FIELDS.map((field) => (
            <Fragment key={field}>
              <div className="flex items-center text-xs font-medium text-cm-text-secondary">
                {field}
              </div>
              {WARDS.map((ward) => {
                const pct = DATA[field][ward];
                return (
                  <div
                    key={`${field}-${ward}`}
                    className={cn(
                      "flex items-center justify-center rounded px-1 py-1.5 text-xs font-medium tabular-nums",
                      getCellColour(pct),
                    )}
                  >
                    {pct}%
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
