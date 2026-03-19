import type { LineageEntry } from "../types";

export const MOCK_LINEAGE: LineageEntry[] = [
  {
    metricLabel: "Total Rows Harmonized",
    sourceFileId: "src-001",
    sourceColumn: "*",
    transformations: ["row count aggregation"],
    targetField: "kpi.totalRowsHarmonized",
  },
  {
    metricLabel: "Total Rows Harmonized",
    sourceFileId: "src-002",
    sourceColumn: "*",
    transformations: ["row count aggregation"],
    targetField: "kpi.totalRowsHarmonized",
  },
  {
    metricLabel: "Data Completeness",
    sourceFileId: "src-001",
    sourceColumn: "PatientNr, Sturzrisiko_Skala, Entlassdatum",
    transformations: ["null-rate computation", "weighted average"],
    targetField: "kpi.dataCompleteness",
  },
  {
    metricLabel: "Data Completeness",
    sourceFileId: "src-002",
    sourceColumn: "Laborwert, Ergebnis, Einheit",
    transformations: ["null-rate computation", "weighted average"],
    targetField: "kpi.dataCompleteness",
  },
  {
    metricLabel: "Fields Mapped",
    sourceFileId: "src-001",
    sourceColumn: "PatientNr → patient_id",
    transformations: ["AI-assisted mapping", "user confirmation"],
    targetField: "patient_registry.patient_id",
  },
  {
    metricLabel: "Fields Mapped",
    sourceFileId: "src-002",
    sourceColumn: "Laborwert → lab_test_name",
    transformations: ["AI-assisted mapping", "code lookup"],
    targetField: "lab_results.lab_test_name",
  },
  {
    metricLabel: "Open Alerts",
    sourceFileId: "src-002",
    sourceColumn: "Ergebnis",
    transformations: ["reference range validation"],
    targetField: "quality_alerts",
  },
];
