export interface Database {
  public: {
    Tables: {
      patients: { Row: PatientRow; Insert: PatientInsert };
      encounters: { Row: EncounterRow; Insert: EncounterInsert };
      diagnoses: { Row: DiagnosisRow; Insert: DiagnosisInsert };
      lab_results: { Row: LabResultRow; Insert: LabResultInsert };
      vital_signs: { Row: VitalSignRow; Insert: VitalSignInsert };
      medications: { Row: MedicationRow; Insert: MedicationInsert };
      care_assessments: { Row: CareAssessmentRow; Insert: CareAssessmentInsert };
      care_interventions: { Row: CareInterventionRow; Insert: CareInterventionInsert };
      sensor_readings: { Row: SensorReadingRow; Insert: SensorReadingInsert };
      staff_schedules: { Row: StaffScheduleRow; Insert: StaffScheduleInsert };
      source_files: { Row: SourceFileRow; Insert: SourceFileInsert };
      source_profiles: { Row: SourceProfileRow; Insert: SourceProfileInsert };
      field_mappings: { Row: FieldMappingRow; Insert: FieldMappingInsert };
      semantic_entities: { Row: SemanticEntityRow; Insert: SemanticEntityInsert };
      semantic_fields: { Row: SemanticFieldRow; Insert: SemanticFieldInsert };
      semantic_joins: { Row: SemanticJoinRow; Insert: SemanticJoinInsert };
      pipeline_nodes: { Row: PipelineNodeRow; Insert: PipelineNodeInsert };
      pipeline_edges: { Row: PipelineEdgeRow; Insert: PipelineEdgeInsert };
      pinned_widgets: { Row: PinnedWidgetRow; Insert: PinnedWidgetInsert };
      quality_alerts: { Row: QualityAlertRow; Insert: QualityAlertInsert };
      projects: { Row: ProjectRow; Insert: ProjectInsert };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// ── Clinical Tables ──

export interface PatientRow {
  id: string;
  external_id: string;
  birth_year: number | null;
  gender: string | null;
  created_at: string;
}
export type PatientInsert = Omit<PatientRow, "id" | "created_at">;

export interface EncounterRow {
  id: string;
  patient_id: string;
  type: string;
  ward: string | null;
  start_date: string | null;
  end_date: string | null;
}
export type EncounterInsert = Omit<EncounterRow, "id">;

export interface DiagnosisRow {
  id: string;
  encounter_id: string;
  code: string;
  code_system: string | null;
  description: string | null;
  date: string | null;
}
export type DiagnosisInsert = Omit<DiagnosisRow, "id">;

export interface LabResultRow {
  id: string;
  encounter_id: string;
  test_code: string | null;
  test_name: string;
  value: number;
  unit: string;
  reference_range: string | null;
  measured_at: string;
}
export type LabResultInsert = Omit<LabResultRow, "id">;

export interface VitalSignRow {
  id: string;
  encounter_id: string;
  type: string;
  value: number;
  unit: string;
  measured_at: string;
}
export type VitalSignInsert = Omit<VitalSignRow, "id">;

export interface MedicationRow {
  id: string;
  encounter_id: string;
  drug_name: string;
  drug_code: string | null;
  dose: number | null;
  unit: string | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
}
export type MedicationInsert = Omit<MedicationRow, "id">;

export interface CareAssessmentRow {
  id: string;
  encounter_id: string;
  patient_id: string;
  assessment_type: string;
  score: number;
  scale_min: number | null;
  scale_max: number | null;
  assessed_at: string;
  assessor: string | null;
}
export type CareAssessmentInsert = Omit<CareAssessmentRow, "id">;

export interface CareInterventionRow {
  id: string;
  encounter_id: string;
  intervention_type: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}
export type CareInterventionInsert = Omit<CareInterventionRow, "id">;

export interface SensorReadingRow {
  id: string;
  patient_id: string;
  sensor_type: string;
  value: number;
  unit: string;
  measured_at: string;
}
export type SensorReadingInsert = Omit<SensorReadingRow, "id">;

export interface StaffScheduleRow {
  id: string;
  staff_id: string;
  ward: string;
  role: string;
  shift_start: string;
  shift_end: string;
}
export type StaffScheduleInsert = Omit<StaffScheduleRow, "id">;

// ── Pipeline & Metadata Tables ──

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}
export type ProjectInsert = Omit<ProjectRow, "id" | "created_at" | "updated_at">;

export interface SourceFileRow {
  id: string;
  project_id: string;
  filename: string;
  file_type: string;
  uploaded_at: string;
  row_count: number | null;
  column_count: number | null;
  raw_profile: Record<string, unknown> | null;
  storage_path: string | null;
}
export type SourceFileInsert = Omit<SourceFileRow, "id" | "uploaded_at">;

export interface SourceProfileRow {
  id: string;
  source_file_id: string;
  column_name: string;
  inferred_type: string;
  semantic_label: string | null;
  domain: string | null;
  confidence: number;
  sample_values: unknown[];
  quality_flags: string[];
  user_corrected: boolean;
}
export type SourceProfileInsert = Omit<SourceProfileRow, "id">;

export interface FieldMappingRow {
  id: string;
  project_id: string;
  source_file_id: string;
  source_column: string;
  target_table: string;
  target_column: string;
  transformation: string | null;
  confidence: number;
  reasoning: string | null;
  status: "pending" | "accepted" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
}
export type FieldMappingInsert = Omit<FieldMappingRow, "id">;

export interface SemanticEntityRow {
  id: string;
  project_id: string;
  entity_name: string;
  description: string | null;
  sql_table_name: string;
  created_from: string[];
  updated_at: string;
}
export type SemanticEntityInsert = Omit<SemanticEntityRow, "id" | "updated_at">;

export interface SemanticFieldRow {
  id: string;
  entity_id: string;
  field_name: string;
  sql_expression: string;
  data_type: string;
  description: string | null;
}
export type SemanticFieldInsert = Omit<SemanticFieldRow, "id">;

export interface SemanticJoinRow {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  join_sql: string;
}
export type SemanticJoinInsert = Omit<SemanticJoinRow, "id">;

export interface PipelineNodeRow {
  id: string;
  project_id: string;
  node_type: string;
  label: string;
  config: Record<string, unknown> | null;
  position: { x: number; y: number };
  status: string;
}
export type PipelineNodeInsert = Omit<PipelineNodeRow, "id">;

export interface PipelineEdgeRow {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
}
export type PipelineEdgeInsert = Omit<PipelineEdgeRow, "id">;

export interface PinnedWidgetRow {
  id: string;
  project_id: string;
  title: string;
  query_text: string;
  sql_query: string;
  chart_spec: Record<string, unknown>;
  pinned_at: string;
}
export type PinnedWidgetInsert = Omit<PinnedWidgetRow, "id" | "pinned_at">;

export interface QualityAlertRow {
  id: string;
  project_id: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  source_file_id: string | null;
  affected_count: number;
  detection_method: string | null;
  acknowledged: boolean;
  created_at: string;
}
export type QualityAlertInsert = Omit<QualityAlertRow, "id" | "created_at">;
