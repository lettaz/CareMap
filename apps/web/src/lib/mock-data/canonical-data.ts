export interface CareAssessmentRow {
  id: string;
  patient_id: string;
  ward: string;
  assessment_type: string;
  score: number;
  assessed_at: string;
}

export interface LabResultRow {
  id: string;
  patient_id: string;
  test_name: string;
  value: number;
  unit: string;
  reference_range: string;
  measured_at: string;
}

export const MOCK_CARE_ASSESSMENTS: CareAssessmentRow[] = [
  { id: "ca-001", patient_id: "P-10042", ward: "A1", assessment_type: "fall_risk", score: 3, assessed_at: "2026-03-10T08:30:00Z" },
  { id: "ca-002", patient_id: "P-10042", ward: "A1", assessment_type: "mobility", score: 2, assessed_at: "2026-03-10T08:35:00Z" },
  { id: "ca-003", patient_id: "P-10078", ward: "A2", assessment_type: "fall_risk", score: 1, assessed_at: "2026-03-10T09:15:00Z" },
  { id: "ca-004", patient_id: "P-10078", ward: "A2", assessment_type: "pain", score: 6, assessed_at: "2026-03-10T09:20:00Z" },
  { id: "ca-005", patient_id: "P-10115", ward: "B1", assessment_type: "fall_risk", score: 4, assessed_at: "2026-03-11T07:45:00Z" },
  { id: "ca-006", patient_id: "P-10115", ward: "B1", assessment_type: "nutrition", score: 1, assessed_at: "2026-03-11T07:50:00Z" },
  { id: "ca-007", patient_id: "P-10203", ward: "B2", assessment_type: "fall_risk", score: 2, assessed_at: "2026-03-11T10:00:00Z" },
  { id: "ca-008", patient_id: "P-10203", ward: "B2", assessment_type: "mobility", score: 3, assessed_at: "2026-03-11T10:05:00Z" },
  { id: "ca-009", patient_id: "P-10287", ward: "C1", assessment_type: "fall_risk", score: 0, assessed_at: "2026-03-12T08:00:00Z" },
  { id: "ca-010", patient_id: "P-10287", ward: "C1", assessment_type: "pain", score: 2, assessed_at: "2026-03-12T08:05:00Z" },
  { id: "ca-011", patient_id: "P-10312", ward: "A1", assessment_type: "fall_risk", score: 3, assessed_at: "2026-03-12T09:30:00Z" },
  { id: "ca-012", patient_id: "P-10312", ward: "A1", assessment_type: "pressure_ulcer", score: 2, assessed_at: "2026-03-12T09:35:00Z" },
  { id: "ca-013", patient_id: "P-10345", ward: "A2", assessment_type: "fall_risk", score: 1, assessed_at: "2026-03-13T07:20:00Z" },
  { id: "ca-014", patient_id: "P-10345", ward: "A2", assessment_type: "mobility", score: 4, assessed_at: "2026-03-13T07:25:00Z" },
  { id: "ca-015", patient_id: "P-10398", ward: "B1", assessment_type: "fall_risk", score: 2, assessed_at: "2026-03-13T11:00:00Z" },
  { id: "ca-016", patient_id: "P-10398", ward: "B1", assessment_type: "nutrition", score: 3, assessed_at: "2026-03-13T11:05:00Z" },
  { id: "ca-017", patient_id: "P-10421", ward: "B2", assessment_type: "fall_risk", score: 4, assessed_at: "2026-03-14T08:15:00Z" },
  { id: "ca-018", patient_id: "P-10421", ward: "B2", assessment_type: "pain", score: 8, assessed_at: "2026-03-14T08:20:00Z" },
  { id: "ca-019", patient_id: "P-10456", ward: "C1", assessment_type: "fall_risk", score: 1, assessed_at: "2026-03-14T09:45:00Z" },
  { id: "ca-020", patient_id: "P-10456", ward: "C1", assessment_type: "mobility", score: 3, assessed_at: "2026-03-14T09:50:00Z" },
  { id: "ca-021", patient_id: "P-10489", ward: "A1", assessment_type: "fall_risk", score: 2, assessed_at: "2026-03-15T07:30:00Z" },
  { id: "ca-022", patient_id: "P-10489", ward: "A1", assessment_type: "pressure_ulcer", score: 0, assessed_at: "2026-03-15T07:35:00Z" },
  { id: "ca-023", patient_id: "P-10512", ward: "B1", assessment_type: "fall_risk", score: 3, assessed_at: "2026-03-15T10:15:00Z" },
  { id: "ca-024", patient_id: "P-10512", ward: "B1", assessment_type: "pain", score: 5, assessed_at: "2026-03-15T10:20:00Z" },
  { id: "ca-025", patient_id: "P-10547", ward: "C1", assessment_type: "fall_risk", score: 0, assessed_at: "2026-03-16T08:00:00Z" },
];

export const MOCK_LAB_RESULTS: LabResultRow[] = [
  { id: "lr-001", patient_id: "P-10042", test_name: "Hämoglobin", value: 13.2, unit: "g/dL", reference_range: "12.0–16.0", measured_at: "2026-03-10T08:15:00Z" },
  { id: "lr-002", patient_id: "P-10042", test_name: "Kreatinin", value: 1.1, unit: "mg/dL", reference_range: "0.6–1.2", measured_at: "2026-03-10T08:15:00Z" },
  { id: "lr-003", patient_id: "P-10078", test_name: "CRP", value: 48.5, unit: "mg/L", reference_range: "<5.0", measured_at: "2026-03-10T09:00:00Z" },
  { id: "lr-004", patient_id: "P-10078", test_name: "Leukozyten", value: 12.4, unit: "×10³/µL", reference_range: "4.0–10.0", measured_at: "2026-03-10T09:00:00Z" },
  { id: "lr-005", patient_id: "P-10115", test_name: "Hämoglobin", value: 10.8, unit: "g/dL", reference_range: "12.0–16.0", measured_at: "2026-03-11T07:30:00Z" },
  { id: "lr-006", patient_id: "P-10115", test_name: "Albumin", value: 2.9, unit: "g/dL", reference_range: "3.5–5.0", measured_at: "2026-03-11T07:30:00Z" },
  { id: "lr-007", patient_id: "P-10203", test_name: "Kreatinin", value: 0.9, unit: "mg/dL", reference_range: "0.6–1.2", measured_at: "2026-03-11T10:45:00Z" },
  { id: "lr-008", patient_id: "P-10203", test_name: "CRP", value: 3.2, unit: "mg/L", reference_range: "<5.0", measured_at: "2026-03-11T10:45:00Z" },
  { id: "lr-009", patient_id: "P-10287", test_name: "Leukozyten", value: 6.8, unit: "×10³/µL", reference_range: "4.0–10.0", measured_at: "2026-03-12T08:20:00Z" },
  { id: "lr-010", patient_id: "P-10287", test_name: "Hämoglobin", value: 14.1, unit: "g/dL", reference_range: "12.0–16.0", measured_at: "2026-03-12T08:20:00Z" },
  { id: "lr-011", patient_id: "P-10312", test_name: "CRP", value: 85.3, unit: "mg/L", reference_range: "<5.0", measured_at: "2026-03-12T09:45:00Z" },
  { id: "lr-012", patient_id: "P-10312", test_name: "Kreatinin", value: 1.8, unit: "mg/dL", reference_range: "0.6–1.2", measured_at: "2026-03-12T09:45:00Z" },
  { id: "lr-013", patient_id: "P-10345", test_name: "Albumin", value: 3.7, unit: "g/dL", reference_range: "3.5–5.0", measured_at: "2026-03-13T07:40:00Z" },
  { id: "lr-014", patient_id: "P-10345", test_name: "Hämoglobin", value: 15.0, unit: "g/dL", reference_range: "12.0–16.0", measured_at: "2026-03-13T07:40:00Z" },
  { id: "lr-015", patient_id: "P-10398", test_name: "Leukozyten", value: 3.2, unit: "×10³/µL", reference_range: "4.0–10.0", measured_at: "2026-03-13T11:20:00Z" },
  { id: "lr-016", patient_id: "P-10398", test_name: "CRP", value: 12.7, unit: "mg/L", reference_range: "<5.0", measured_at: "2026-03-13T11:20:00Z" },
  { id: "lr-017", patient_id: "P-10421", test_name: "Hämoglobin", value: 9.4, unit: "g/dL", reference_range: "12.0–16.0", measured_at: "2026-03-14T08:30:00Z" },
  { id: "lr-018", patient_id: "P-10421", test_name: "Kreatinin", value: 2.3, unit: "mg/dL", reference_range: "0.6–1.2", measured_at: "2026-03-14T08:30:00Z" },
  { id: "lr-019", patient_id: "P-10456", test_name: "Albumin", value: 4.1, unit: "g/dL", reference_range: "3.5–5.0", measured_at: "2026-03-14T10:00:00Z" },
  { id: "lr-020", patient_id: "P-10456", test_name: "Leukozyten", value: 7.5, unit: "×10³/µL", reference_range: "4.0–10.0", measured_at: "2026-03-14T10:00:00Z" },
  { id: "lr-021", patient_id: "P-10489", test_name: "CRP", value: 2.1, unit: "mg/L", reference_range: "<5.0", measured_at: "2026-03-15T07:50:00Z" },
  { id: "lr-022", patient_id: "P-10489", test_name: "Hämoglobin", value: 13.8, unit: "g/dL", reference_range: "12.0–16.0", measured_at: "2026-03-15T07:50:00Z" },
  { id: "lr-023", patient_id: "P-10512", test_name: "Kreatinin", value: 1.0, unit: "mg/dL", reference_range: "0.6–1.2", measured_at: "2026-03-15T10:30:00Z" },
  { id: "lr-024", patient_id: "P-10512", test_name: "Leukozyten", value: 11.2, unit: "×10³/µL", reference_range: "4.0–10.0", measured_at: "2026-03-15T10:30:00Z" },
  { id: "lr-025", patient_id: "P-10547", test_name: "CRP", value: 1.4, unit: "mg/L", reference_range: "<5.0", measured_at: "2026-03-16T08:15:00Z" },
];
