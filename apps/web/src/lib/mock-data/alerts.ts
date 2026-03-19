import type { QualityAlert } from "../types";

export const MOCK_ALERTS: QualityAlert[] = [
  {
    id: "alert-001",
    severity: "critical",
    summary:
      "3 lab values outside reference range detected (CRP 48.5, 85.3 mg/L; Kreatinin 2.3 mg/dL). Possible data entry error or critical clinical findings requiring verification.",
    sourceFileId: "src-002",
    affectedCount: 3,
    detectionMethod: "reference_range_validation",
    acknowledged: false,
    createdAt: "2026-03-14T10:12:00Z",
    affectedRecords: [
      { rowIndex: 42, values: { PatientNr: "P-10078", Laborwert: "CRP", Ergebnis: 48.5, Einheit: "mg/L", Referenzbereich: "0–5" }, anomalousFields: ["Ergebnis"] },
      { rowIndex: 87, values: { PatientNr: "P-10112", Laborwert: "CRP", Ergebnis: 85.3, Einheit: "mg/L", Referenzbereich: "0–5" }, anomalousFields: ["Ergebnis"] },
      { rowIndex: 153, values: { PatientNr: "P-10034", Laborwert: "Kreatinin", Ergebnis: 2.3, Einheit: "mg/dL", Referenzbereich: "0.6–1.2" }, anomalousFields: ["Ergebnis"] },
    ],
  },
  {
    id: "alert-002",
    severity: "critical",
    summary:
      "5 rows in care_assessments.csv have null PatientNr values. These records cannot be linked to the patient registry and will be excluded from harmonised output.",
    sourceFileId: "src-001",
    affectedCount: 5,
    detectionMethod: "null_check",
    acknowledged: false,
    createdAt: "2026-03-14T10:14:00Z",
    affectedRecords: [
      { rowIndex: 15, values: { PatientNr: null, Sturzrisiko_Skala: 2, Station: "B2", Datum: "2026-03-10" }, anomalousFields: ["PatientNr"] },
      { rowIndex: 48, values: { PatientNr: null, Sturzrisiko_Skala: 3, Station: "B2", Datum: "2026-03-11" }, anomalousFields: ["PatientNr"] },
      { rowIndex: 92, values: { PatientNr: null, Sturzrisiko_Skala: 1, Station: "A1", Datum: "2026-03-12" }, anomalousFields: ["PatientNr"] },
      { rowIndex: 178, values: { PatientNr: null, Sturzrisiko_Skala: 4, Station: "B1", Datum: "2026-03-13" }, anomalousFields: ["PatientNr"] },
      { rowIndex: 201, values: { PatientNr: null, Sturzrisiko_Skala: 0, Station: "C1", Datum: "2026-03-14" }, anomalousFields: ["PatientNr"] },
    ],
  },
  {
    id: "alert-003",
    severity: "warning",
    summary:
      "Ward B2 data completeness is 74% — below the 80% threshold. 16 of 62 expected assessment fields are missing across 8 patient records.",
    sourceFileId: "src-001",
    affectedCount: 16,
    detectionMethod: "completeness_score",
    acknowledged: false,
    createdAt: "2026-03-14T10:18:00Z",
  },
  {
    id: "alert-004",
    severity: "warning",
    summary:
      "Date format inconsistency in Entlassdatum column: 83% use ISO 8601 (YYYY-MM-DD), 17% use DD.MM.YYYY German locale format. Standardisation recommended before mapping.",
    sourceFileId: "src-001",
    affectedCount: 42,
    detectionMethod: "format_consistency_check",
    acknowledged: true,
    createdAt: "2026-03-14T10:22:00Z",
  },
  {
    id: "alert-005",
    severity: "info",
    summary:
      "New unmapped field 'Bemerkung' detected in care_assessments.csv. Field contains free-text clinical notes with 68% null rate. Review recommended to determine mapping target.",
    sourceFileId: "src-001",
    affectedCount: 1,
    detectionMethod: "schema_drift_detection",
    acknowledged: false,
    createdAt: "2026-03-14T10:25:00Z",
  },
];
