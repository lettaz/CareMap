export interface SourcePreviewColumn {
  name: string;
  type: "string" | "number" | "date" | "code";
  nullCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
  topValues?: string[];
}

export interface SourcePreview {
  sourceFileId: string;
  filename: string;
  totalRows: number;
  totalColumns: number;
  columns: SourcePreviewColumn[];
  rows: Record<string, string | number | null>[];
  aiSummary: string;
  issueCount: number;
  completeness: number;
}

export const MOCK_SOURCE_PREVIEWS: Record<string, SourcePreview> = {
  "src-001": {
    sourceFileId: "src-001",
    filename: "care_assessments.csv",
    totalRows: 247,
    totalColumns: 12,
    completeness: 0.87,
    issueCount: 3,
    aiSummary:
      "Care assessment dataset with 247 patient records across 5 clinical domains. 3 columns have quality issues — Entlassdatum has 34% nulls, Bemerkung has 61% nulls with unclear semantics, and Station has low cardinality.",
    columns: [
      { name: "PatientNr", type: "string", nullCount: 0, uniqueCount: 52, topValues: ["P-10042", "P-10078", "P-10115", "P-10203"] },
      { name: "Station", type: "string", nullCount: 0, uniqueCount: 5, topValues: ["A1", "A2", "B1", "B2", "C1"] },
      { name: "Datum", type: "date", nullCount: 0, uniqueCount: 14 },
      { name: "Aufnahmedatum", type: "date", nullCount: 0, uniqueCount: 31 },
      { name: "Entlassdatum", type: "date", nullCount: 84, uniqueCount: 28 },
      { name: "Sturzrisiko_Skala", type: "number", nullCount: 0, uniqueCount: 5, min: 0, max: 4, mean: 2.1 },
      { name: "Mobilität", type: "number", nullCount: 0, uniqueCount: 5, min: 1, max: 4, mean: 2.6 },
      { name: "Ernährung", type: "number", nullCount: 0, uniqueCount: 4, min: 1, max: 4, mean: 2.3 },
      { name: "Schmerz", type: "number", nullCount: 2, uniqueCount: 9, min: 0, max: 9, mean: 4.1 },
      { name: "Dekubitus", type: "number", nullCount: 0, uniqueCount: 4, min: 0, max: 3, mean: 0.9 },
      { name: "Beurteiler", type: "string", nullCount: 0, uniqueCount: 8, topValues: ["Müller, K.", "Schmidt, A.", "Weber, L."] },
      { name: "Bemerkung", type: "string", nullCount: 151, uniqueCount: 38, topValues: ["Sturzgefahr erhöht", "Mobilisation eingeleitet"] },
    ],
    rows: [
      { PatientNr: "P-10042", Station: "A1", Datum: "2026-03-10", Aufnahmedatum: "2026-03-01", Entlassdatum: "2026-03-15", Sturzrisiko_Skala: 3, "Mobilität": 2, "Ernährung": 2, Schmerz: 4, Dekubitus: 0, Beurteiler: "Müller, K.", Bemerkung: "Sturzgefahr erhöht" },
      { PatientNr: "P-10042", Station: "A1", Datum: "2026-03-11", Aufnahmedatum: "2026-03-01", Entlassdatum: "2026-03-15", Sturzrisiko_Skala: 2, "Mobilität": 3, "Ernährung": 2, Schmerz: 3, Dekubitus: 0, Beurteiler: "Müller, K.", Bemerkung: null },
      { PatientNr: "P-10078", Station: "A2", Datum: "2026-03-10", Aufnahmedatum: "2026-02-27", Entlassdatum: null, Sturzrisiko_Skala: 1, "Mobilität": 4, "Ernährung": 3, Schmerz: 6, Dekubitus: 1, Beurteiler: "Schmidt, A.", Bemerkung: null },
      { PatientNr: "P-10078", Station: "A2", Datum: "2026-03-11", Aufnahmedatum: "2026-02-27", Entlassdatum: null, Sturzrisiko_Skala: 1, "Mobilität": 4, "Ernährung": 3, Schmerz: 7, Dekubitus: 1, Beurteiler: "Schmidt, A.", Bemerkung: "Schmerzmedikation angepasst" },
      { PatientNr: "P-10115", Station: "B1", Datum: "2026-03-11", Aufnahmedatum: "2026-03-05", Entlassdatum: "2026-03-18", Sturzrisiko_Skala: 4, "Mobilität": 1, "Ernährung": 1, Schmerz: 2, Dekubitus: 2, Beurteiler: "Weber, L.", Bemerkung: "Mobilisation eingeleitet" },
      { PatientNr: "P-10203", Station: "B2", Datum: "2026-03-11", Aufnahmedatum: "2026-03-08", Entlassdatum: null, Sturzrisiko_Skala: 2, "Mobilität": 3, "Ernährung": 2, Schmerz: 0, Dekubitus: 0, Beurteiler: "Müller, K.", Bemerkung: null },
      { PatientNr: "P-10287", Station: "C1", Datum: "2026-03-12", Aufnahmedatum: "2026-03-10", Entlassdatum: null, Sturzrisiko_Skala: 0, "Mobilität": 4, "Ernährung": 3, Schmerz: 2, Dekubitus: 0, Beurteiler: "Schmidt, A.", Bemerkung: null },
      { PatientNr: "P-10312", Station: "A1", Datum: "2026-03-12", Aufnahmedatum: "2026-03-06", Entlassdatum: "2026-03-19", Sturzrisiko_Skala: 3, "Mobilität": 2, "Ernährung": 3, Schmerz: 5, Dekubitus: 2, Beurteiler: "Weber, L.", Bemerkung: "Dekubitusprophylaxe verstärkt" },
      { PatientNr: "P-10345", Station: "A2", Datum: "2026-03-13", Aufnahmedatum: "2026-03-09", Entlassdatum: null, Sturzrisiko_Skala: 1, "Mobilität": 4, "Ernährung": 3, Schmerz: 1, Dekubitus: 0, Beurteiler: "Müller, K.", Bemerkung: null },
      { PatientNr: "P-10398", Station: "B1", Datum: "2026-03-13", Aufnahmedatum: "2026-03-07", Entlassdatum: "2026-03-20", Sturzrisiko_Skala: 2, "Mobilität": 3, "Ernährung": 3, Schmerz: 8, Dekubitus: 1, Beurteiler: "Schmidt, A.", Bemerkung: "Sturzgefahr erhöht" },
      { PatientNr: "P-10421", Station: "B2", Datum: "2026-03-14", Aufnahmedatum: "2026-03-11", Entlassdatum: null, Sturzrisiko_Skala: 4, "Mobilität": 1, "Ernährung": 2, Schmerz: 8, Dekubitus: 3, Beurteiler: "Weber, L.", Bemerkung: "Intensivpflege erforderlich" },
      { PatientNr: "P-10456", Station: "C1", Datum: "2026-03-14", Aufnahmedatum: "2026-03-12", Entlassdatum: null, Sturzrisiko_Skala: 1, "Mobilität": 3, "Ernährung": 4, Schmerz: null, Dekubitus: 0, Beurteiler: "Müller, K.", Bemerkung: null },
      { PatientNr: "P-10489", Station: "A1", Datum: "2026-03-15", Aufnahmedatum: "2026-03-10", Entlassdatum: null, Sturzrisiko_Skala: 2, "Mobilität": 3, "Ernährung": 2, Schmerz: 3, Dekubitus: 0, Beurteiler: "Schmidt, A.", Bemerkung: null },
      { PatientNr: "P-10512", Station: "B1", Datum: "2026-03-15", Aufnahmedatum: "2026-03-13", Entlassdatum: null, Sturzrisiko_Skala: 3, "Mobilität": 2, "Ernährung": 1, Schmerz: 5, Dekubitus: 1, Beurteiler: "Weber, L.", Bemerkung: "Ernährungsberatung angeordnet" },
      { PatientNr: "P-10547", Station: "C1", Datum: "2026-03-16", Aufnahmedatum: "2026-03-14", Entlassdatum: null, Sturzrisiko_Skala: 0, "Mobilität": 4, "Ernährung": 3, Schmerz: 1, Dekubitus: 0, Beurteiler: "Müller, K.", Bemerkung: null },
    ],
  },

  "src-002": {
    sourceFileId: "src-002",
    filename: "lab_results.xlsx",
    totalRows: 512,
    totalColumns: 8,
    completeness: 0.94,
    issueCount: 1,
    aiSummary:
      "Lab results dataset with 512 records across 4 test types (Hämoglobin, Kreatinin, CRP, Leukozyten). 1 issue — Station column has low cardinality suggesting ward codes rather than descriptive names.",
    columns: [
      { name: "PatientNr", type: "string", nullCount: 0, uniqueCount: 52, topValues: ["P-10042", "P-10078", "P-10115"] },
      { name: "Laborwert", type: "string", nullCount: 0, uniqueCount: 6, topValues: ["Hämoglobin", "Kreatinin", "CRP", "Leukozyten", "Albumin"] },
      { name: "Ergebnis", type: "number", nullCount: 0, uniqueCount: 187, min: 0.6, max: 85.3, mean: 12.4 },
      { name: "Einheit", type: "string", nullCount: 0, uniqueCount: 4, topValues: ["g/dL", "mg/dL", "mg/L", "×10³/µL"] },
      { name: "Referenzbereich", type: "string", nullCount: 0, uniqueCount: 5, topValues: ["12.0–16.0", "0.6–1.2", "<5.0", "4.0–10.0"] },
      { name: "Messzeitpunkt", type: "date", nullCount: 0, uniqueCount: 98 },
      { name: "Laborcode", type: "code", nullCount: 0, uniqueCount: 5, topValues: ["HGB", "CREA", "CRP", "WBC", "ALB"] },
      { name: "Station", type: "string", nullCount: 0, uniqueCount: 5, topValues: ["A1", "A2", "B1", "B2", "C1"] },
    ],
    rows: [
      { PatientNr: "P-10042", Laborwert: "Hämoglobin", Ergebnis: 13.2, Einheit: "g/dL", Referenzbereich: "12.0–16.0", Messzeitpunkt: "2026-03-10T08:15", Laborcode: "HGB", Station: "A1" },
      { PatientNr: "P-10042", Laborwert: "Kreatinin", Ergebnis: 1.1, Einheit: "mg/dL", Referenzbereich: "0.6–1.2", Messzeitpunkt: "2026-03-10T08:15", Laborcode: "CREA", Station: "A1" },
      { PatientNr: "P-10078", Laborwert: "CRP", Ergebnis: 48.5, Einheit: "mg/L", Referenzbereich: "<5.0", Messzeitpunkt: "2026-03-10T09:00", Laborcode: "CRP", Station: "A2" },
      { PatientNr: "P-10078", Laborwert: "Leukozyten", Ergebnis: 12.4, Einheit: "×10³/µL", Referenzbereich: "4.0–10.0", Messzeitpunkt: "2026-03-10T09:00", Laborcode: "WBC", Station: "A2" },
      { PatientNr: "P-10115", Laborwert: "Hämoglobin", Ergebnis: 10.8, Einheit: "g/dL", Referenzbereich: "12.0–16.0", Messzeitpunkt: "2026-03-11T07:30", Laborcode: "HGB", Station: "B1" },
      { PatientNr: "P-10115", Laborwert: "Albumin", Ergebnis: 2.9, Einheit: "g/dL", Referenzbereich: "3.5–5.0", Messzeitpunkt: "2026-03-11T07:30", Laborcode: "ALB", Station: "B1" },
      { PatientNr: "P-10203", Laborwert: "Kreatinin", Ergebnis: 0.9, Einheit: "mg/dL", Referenzbereich: "0.6–1.2", Messzeitpunkt: "2026-03-11T10:45", Laborcode: "CREA", Station: "B2" },
      { PatientNr: "P-10203", Laborwert: "CRP", Ergebnis: 3.2, Einheit: "mg/L", Referenzbereich: "<5.0", Messzeitpunkt: "2026-03-11T10:45", Laborcode: "CRP", Station: "B2" },
      { PatientNr: "P-10287", Laborwert: "Leukozyten", Ergebnis: 6.8, Einheit: "×10³/µL", Referenzbereich: "4.0–10.0", Messzeitpunkt: "2026-03-12T08:20", Laborcode: "WBC", Station: "C1" },
      { PatientNr: "P-10287", Laborwert: "Hämoglobin", Ergebnis: 14.1, Einheit: "g/dL", Referenzbereich: "12.0–16.0", Messzeitpunkt: "2026-03-12T08:20", Laborcode: "HGB", Station: "C1" },
      { PatientNr: "P-10312", Laborwert: "CRP", Ergebnis: 85.3, Einheit: "mg/L", Referenzbereich: "<5.0", Messzeitpunkt: "2026-03-12T09:45", Laborcode: "CRP", Station: "A1" },
      { PatientNr: "P-10312", Laborwert: "Kreatinin", Ergebnis: 1.8, Einheit: "mg/dL", Referenzbereich: "0.6–1.2", Messzeitpunkt: "2026-03-12T09:45", Laborcode: "CREA", Station: "A1" },
      { PatientNr: "P-10345", Laborwert: "Albumin", Ergebnis: 3.7, Einheit: "g/dL", Referenzbereich: "3.5–5.0", Messzeitpunkt: "2026-03-13T07:40", Laborcode: "ALB", Station: "A2" },
      { PatientNr: "P-10345", Laborwert: "Hämoglobin", Ergebnis: 15.0, Einheit: "g/dL", Referenzbereich: "12.0–16.0", Messzeitpunkt: "2026-03-13T07:40", Laborcode: "HGB", Station: "A2" },
      { PatientNr: "P-10398", Laborwert: "Leukozyten", Ergebnis: 3.2, Einheit: "×10³/µL", Referenzbereich: "4.0–10.0", Messzeitpunkt: "2026-03-13T11:20", Laborcode: "WBC", Station: "B1" },
    ],
  },
};
