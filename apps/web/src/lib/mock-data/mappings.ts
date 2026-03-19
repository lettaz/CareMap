import type { FieldMapping, TargetTableMapping, JoinKey } from "../types";

// ── Legacy flat mappings (kept for backward compat, agent store references) ──

export const MOCK_MAPPINGS: FieldMapping[] = [
  { id: "map-001", sourceFileId: "src-001", sourceColumn: "Sturzrisiko_Skala", sampleValue: "3", targetTable: "care_assessments", targetColumn: "score", confidence: 0.92, reasoning: "Column name translates to 'Fall Risk Scale', values 0–4 match score range.", status: "accepted", transformation: "CAST(value AS INTEGER)" },
  { id: "map-002", sourceFileId: "src-001", sourceColumn: "Mobilität", sampleValue: "2", targetTable: "care_assessments", targetColumn: "score", confidence: 0.87, reasoning: "German for 'Mobility'. Values 0–4 consistent with mobility scale.", status: "accepted", transformation: "CAST(value AS INTEGER)" },
  { id: "map-003", sourceFileId: "src-001", sourceColumn: "Ernährung", sampleValue: "2", targetTable: "care_assessments", targetColumn: "score", confidence: 0.85, reasoning: "Translates to 'Nutrition'. Numeric values indicate nutrition screening score.", status: "accepted", transformation: "CAST(value AS INTEGER)" },
  { id: "map-004", sourceFileId: "src-001", sourceColumn: "Schmerz", sampleValue: "4", targetTable: "care_assessments", targetColumn: "score", confidence: 0.89, reasoning: "Translates to 'Pain'. Values 0–10 align with VAS pain scoring.", status: "accepted", transformation: "CAST(value AS INTEGER)" },
  { id: "map-005", sourceFileId: "src-001", sourceColumn: "Dekubitus", sampleValue: "0", targetTable: "care_assessments", targetColumn: "score", confidence: 0.91, reasoning: "Translates to 'Pressure Ulcer'. Values 0–4 match Braden sub-scale.", status: "accepted", transformation: "CAST(value AS INTEGER)" },
  { id: "map-006", sourceFileId: "src-001", sourceColumn: "PatientNr", sampleValue: "P-10042", targetTable: "patients", targetColumn: "external_id", confidence: 0.95, reasoning: "Patient number field. Format P-XXXXX matches patient registry.", status: "accepted" },
  { id: "map-007", sourceFileId: "src-001", sourceColumn: "Station", sampleValue: "A1", targetTable: "encounters", targetColumn: "ward", confidence: 0.78, reasoning: "German for 'Ward/Station'. Values A1, A2, B1 match known wards.", status: "accepted" },
  { id: "map-008", sourceFileId: "src-001", sourceColumn: "Datum", sampleValue: "2026-03-10", targetTable: "care_assessments", targetColumn: "assessed_at", confidence: 0.9, reasoning: "Translates to 'Date'. ISO 8601 format dates.", status: "accepted", transformation: "CAST(value AS TIMESTAMP)" },
  { id: "map-009", sourceFileId: "src-001", sourceColumn: "Beurteiler", sampleValue: "Müller, K.", targetTable: "care_assessments", targetColumn: "assessor", confidence: 0.83, reasoning: "Translates to 'Assessor'. Staff surname-initial patterns.", status: "accepted" },
  { id: "map-010", sourceFileId: "src-001", sourceColumn: "Aufnahmedatum", sampleValue: "2026-03-01", targetTable: "encounters", targetColumn: "start_date", confidence: 0.88, reasoning: "Translates to 'Admission Date'. Links to encounter.", status: "accepted", transformation: "CAST(value AS DATE)" },
  { id: "map-011", sourceFileId: "src-001", sourceColumn: "Entlassdatum", sampleValue: "2026-03-15", targetTable: "encounters", targetColumn: "end_date", confidence: 0.72, reasoning: "Translates to 'Discharge Date'. Contains nulls for current inpatients.", status: "pending", transformation: "CAST(value AS DATE)" },
  { id: "map-012", sourceFileId: "src-001", sourceColumn: "Bemerkung", sampleValue: "Sturzgefahr erhöht", targetTable: "", targetColumn: "", confidence: 0.34, reasoning: "Free-text 'Notes' field. 61% null rate, unclear purpose.", status: "rejected" },
  { id: "map-013", sourceFileId: "src-002", sourceColumn: "PatientNr", sampleValue: "P-10042", targetTable: "patients", targetColumn: "external_id", confidence: 0.95, reasoning: "Same format as care_assessments source, enabling cross-file joins.", status: "accepted" },
  { id: "map-014", sourceFileId: "src-002", sourceColumn: "Laborwert", sampleValue: "Hämoglobin", targetTable: "lab_results", targetColumn: "test_name", confidence: 0.88, reasoning: "Translates to 'Lab Value'. Standardised German test names.", status: "accepted" },
  { id: "map-015", sourceFileId: "src-002", sourceColumn: "Ergebnis", sampleValue: "13.2", targetTable: "lab_results", targetColumn: "value", confidence: 0.91, reasoning: "Translates to 'Result'. Numeric lab measurement values.", status: "accepted", transformation: "CAST(value AS DECIMAL(10,2))" },
  { id: "map-016", sourceFileId: "src-002", sourceColumn: "Einheit", sampleValue: "g/dL", targetTable: "lab_results", targetColumn: "unit", confidence: 0.93, reasoning: "Translates to 'Unit'. Standard measurement units.", status: "accepted" },
  { id: "map-017", sourceFileId: "src-002", sourceColumn: "Referenzbereich", sampleValue: "12.0–16.0", targetTable: "lab_results", targetColumn: "reference_range", confidence: 0.85, reasoning: "Translates to 'Reference Range'. Min–max format.", status: "accepted" },
  { id: "map-018", sourceFileId: "src-002", sourceColumn: "Messzeitpunkt", sampleValue: "2026-03-10T08:15", targetTable: "lab_results", targetColumn: "measured_at", confidence: 0.9, reasoning: "Translates to 'Measurement Time'. ISO 8601 timestamps.", status: "accepted", transformation: "CAST(value AS TIMESTAMPTZ)" },
  { id: "map-019", sourceFileId: "src-002", sourceColumn: "Laborcode", sampleValue: "HGB", targetTable: "lab_results", targetColumn: "test_code", confidence: 0.65, reasoning: "Non-standard abbreviations. Needs terminology validation.", status: "pending" },
  { id: "map-020", sourceFileId: "src-002", sourceColumn: "Station", sampleValue: "A1", targetTable: "encounters", targetColumn: "ward", confidence: 0.76, reasoning: "Ward identifier. Should link via encounters rather than denormalise.", status: "pending" },
];

// ── Target-centric view: what each canonical table looks like when assembled ──

export const MOCK_TARGET_TABLES: TargetTableMapping[] = [
  {
    targetTable: "care_assessments",
    label: "Care Assessments",
    sourceFileIds: ["src-001"],
    columns: [
      { column: "patient_id", dataType: "uuid", required: true, description: "Reference to patient", status: "mapped", sourceMapping: { sourceFileId: "src-001", sourceColumn: "PatientNr", sampleValue: "P-10042", confidence: 0.95, reasoning: "Patient number field. Joins through patients.external_id.", mappingStatus: "accepted", transformation: "LOOKUP(patients.id WHERE external_id = value)" } },
      { column: "encounter_id", dataType: "uuid", required: true, description: "Reference to encounter", status: "derived", derivedValue: "Derived from PatientNr + Datum via encounters lookup" },
      { column: "assessment_type", dataType: "text", required: true, description: "Type of assessment (fall_risk, mobility, nutrition, pain, pressure_ulcer)", status: "derived", derivedValue: "Derived from source column name (one row per assessment type)" },
      { column: "score", dataType: "numeric", required: true, description: "Assessment score on native scale", status: "mapped", sourceMapping: { sourceFileId: "src-001", sourceColumn: "Sturzrisiko_Skala", sampleValue: "3", confidence: 0.92, reasoning: "Fall Risk Scale. Additional score columns (Mobilität, Ernährung, Schmerz, Dekubitus) are pivoted into separate rows with their assessment_type.", mappingStatus: "accepted", transformation: "CAST(value AS INTEGER)" } },
      { column: "scale_min", dataType: "numeric", required: false, description: "Minimum value of the scale", status: "derived", derivedValue: "Inferred from assessment_type: fall_risk=0, mobility=0, etc." },
      { column: "scale_max", dataType: "numeric", required: false, description: "Maximum value of the scale", status: "derived", derivedValue: "Inferred from assessment_type: fall_risk=4, pain=10, etc." },
      { column: "assessed_at", dataType: "timestamptz", required: true, description: "When the assessment was performed", status: "mapped", sourceMapping: { sourceFileId: "src-001", sourceColumn: "Datum", sampleValue: "2026-03-10", confidence: 0.9, reasoning: "ISO 8601 date. Represents assessment date.", mappingStatus: "accepted", transformation: "CAST(value AS TIMESTAMP)" } },
      { column: "assessor", dataType: "text", required: false, description: "Name of the assessor", status: "mapped", sourceMapping: { sourceFileId: "src-001", sourceColumn: "Beurteiler", sampleValue: "Müller, K.", confidence: 0.83, reasoning: "Staff surname-initial pattern.", mappingStatus: "accepted" } },
    ],
    joinKeys: [
      { fromTable: "care_assessments", fromColumn: "patient_id", toTable: "patients", toColumn: "id", sharedSourceColumn: "PatientNr", confidence: 0.95 },
      { fromTable: "care_assessments", fromColumn: "encounter_id", toTable: "encounters", toColumn: "id", sharedSourceColumn: "PatientNr + Datum", confidence: 0.85 },
    ],
  },
  {
    targetTable: "lab_results",
    label: "Lab Results",
    sourceFileIds: ["src-002"],
    columns: [
      { column: "encounter_id", dataType: "uuid", required: true, description: "Reference to encounter", status: "derived", derivedValue: "Derived from PatientNr + Messzeitpunkt via encounters lookup" },
      { column: "test_code", dataType: "text", required: false, description: "Standardised test code (LOINC)", status: "partial", sourceMapping: { sourceFileId: "src-002", sourceColumn: "Laborcode", sampleValue: "HGB", confidence: 0.65, reasoning: "Non-standard abbreviations (HGB, CREA, CRP). Needs LOINC terminology mapping.", mappingStatus: "pending" } },
      { column: "test_name", dataType: "text", required: true, description: "Human-readable test name", status: "mapped", sourceMapping: { sourceFileId: "src-002", sourceColumn: "Laborwert", sampleValue: "Hämoglobin", confidence: 0.88, reasoning: "German test names. Can be translated to English.", mappingStatus: "accepted" } },
      { column: "value", dataType: "numeric", required: true, description: "Measurement value", status: "mapped", sourceMapping: { sourceFileId: "src-002", sourceColumn: "Ergebnis", sampleValue: "13.2", confidence: 0.91, reasoning: "Numeric lab result values.", mappingStatus: "accepted", transformation: "CAST(value AS DECIMAL(10,2))" } },
      { column: "unit", dataType: "text", required: true, description: "Unit of measurement", status: "mapped", sourceMapping: { sourceFileId: "src-002", sourceColumn: "Einheit", sampleValue: "g/dL", confidence: 0.93, reasoning: "Standard measurement units.", mappingStatus: "accepted" } },
      { column: "reference_range", dataType: "text", required: false, description: "Normal reference range", status: "mapped", sourceMapping: { sourceFileId: "src-002", sourceColumn: "Referenzbereich", sampleValue: "12.0–16.0", confidence: 0.85, reasoning: "Min–max dash-separated format.", mappingStatus: "accepted" } },
      { column: "measured_at", dataType: "timestamptz", required: true, description: "Measurement timestamp", status: "mapped", sourceMapping: { sourceFileId: "src-002", sourceColumn: "Messzeitpunkt", sampleValue: "2026-03-10T08:15", confidence: 0.9, reasoning: "ISO 8601 timestamps.", mappingStatus: "accepted", transformation: "CAST(value AS TIMESTAMPTZ)" } },
    ],
    joinKeys: [
      { fromTable: "lab_results", fromColumn: "encounter_id", toTable: "encounters", toColumn: "id", sharedSourceColumn: "PatientNr", confidence: 0.95 },
    ],
  },
  {
    targetTable: "encounters",
    label: "Encounters",
    sourceFileIds: ["src-001", "src-002"],
    columns: [
      { column: "patient_id", dataType: "uuid", required: true, description: "Reference to patient", status: "mapped", sourceMapping: { sourceFileId: "src-001", sourceColumn: "PatientNr", sampleValue: "P-10042", confidence: 0.95, reasoning: "Shared across both sources.", mappingStatus: "accepted", transformation: "LOOKUP(patients.id WHERE external_id = value)" } },
      { column: "type", dataType: "text", required: true, description: "Encounter type (inpatient, outpatient, ltc)", status: "derived", derivedValue: "'inpatient' — inferred from Aufnahmedatum/Entlassdatum pattern" },
      { column: "ward", dataType: "text", required: false, description: "Ward/station identifier", status: "mapped", sourceMapping: { sourceFileId: "src-001", sourceColumn: "Station", sampleValue: "A1", confidence: 0.78, reasoning: "Ward codes A1, A2, B1, B2. Present in both sources.", mappingStatus: "accepted" } },
      { column: "start_date", dataType: "date", required: false, description: "Admission date", status: "mapped", sourceMapping: { sourceFileId: "src-001", sourceColumn: "Aufnahmedatum", sampleValue: "2026-03-01", confidence: 0.88, reasoning: "Admission date from care assessments source.", mappingStatus: "accepted", transformation: "CAST(value AS DATE)" } },
      { column: "end_date", dataType: "date", required: false, description: "Discharge date", status: "partial", sourceMapping: { sourceFileId: "src-001", sourceColumn: "Entlassdatum", sampleValue: "2026-03-15", confidence: 0.72, reasoning: "Discharge date. Contains nulls for current inpatients and mixed date formats.", mappingStatus: "pending", transformation: "CAST(value AS DATE)" } },
    ],
    joinKeys: [
      { fromTable: "encounters", fromColumn: "patient_id", toTable: "patients", toColumn: "id", sharedSourceColumn: "PatientNr", confidence: 0.95 },
    ],
  },
  {
    targetTable: "patients",
    label: "Patients",
    sourceFileIds: ["src-001", "src-002"],
    columns: [
      { column: "external_id", dataType: "text", required: true, description: "External patient identifier", status: "mapped", sourceMapping: { sourceFileId: "src-001", sourceColumn: "PatientNr", sampleValue: "P-10042", confidence: 0.95, reasoning: "Shared key across both data sources.", mappingStatus: "accepted" } },
      { column: "birth_year", dataType: "int", required: false, description: "Not available in either source file", status: "gap" },
      { column: "gender", dataType: "text", required: false, description: "Patient gender", status: "gap" },
    ],
    joinKeys: [],
  },
];

export const MOCK_ORPHAN_COLUMNS = [
  { sourceFileId: "src-001", sourceColumn: "Bemerkung", sampleValue: "Sturzgefahr erhöht", confidence: 0.34, reasoning: "Free-text 'Notes' field. 61% null rate, unclear purpose. Could map to care_assessments notes or discard." },
];

export const MOCK_JOIN_KEYS: JoinKey[] = [
  { fromTable: "care_assessments", fromColumn: "patient_id", toTable: "patients", toColumn: "id", sharedSourceColumn: "PatientNr", confidence: 0.95 },
  { fromTable: "lab_results", fromColumn: "encounter_id", toTable: "encounters", toColumn: "id", sharedSourceColumn: "PatientNr", confidence: 0.95 },
  { fromTable: "encounters", fromColumn: "patient_id", toTable: "patients", toColumn: "id", sharedSourceColumn: "PatientNr", confidence: 0.95 },
  { fromTable: "care_assessments", fromColumn: "encounter_id", toTable: "encounters", toColumn: "id", sharedSourceColumn: "PatientNr + Datum", confidence: 0.85 },
];
