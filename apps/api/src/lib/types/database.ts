/**
 * Supabase database types — metadata tables only.
 * Clinical data lives as Parquet files in Supabase Storage,
 * queried via DuckDB in E2B sandboxes.
 */

export interface Database {
  public: {
    Tables: {
      projects: { Row: ProjectRow; Insert: ProjectInsert };
      source_files: { Row: SourceFileRow; Insert: SourceFileInsert };
      source_profiles: { Row: SourceProfileRow; Insert: SourceProfileInsert };
      field_mappings: { Row: FieldMappingRow; Insert: FieldMappingInsert };
      pipeline_nodes: { Row: PipelineNodeRow; Insert: PipelineNodeInsert };
      pipeline_edges: { Row: PipelineEdgeRow; Insert: PipelineEdgeInsert };
      semantic_entities: { Row: SemanticEntityRow; Insert: SemanticEntityInsert };
      semantic_fields: { Row: SemanticFieldRow; Insert: SemanticFieldInsert };
      semantic_joins: { Row: SemanticJoinRow; Insert: SemanticJoinInsert };
      pinned_widgets: { Row: PinnedWidgetRow; Insert: PinnedWidgetInsert };
      quality_alerts: { Row: QualityAlertRow; Insert: QualityAlertInsert };
      conversations: { Row: ConversationRow; Insert: ConversationInsert };
      conversation_messages: { Row: ConversationMessageRow; Insert: ConversationMessageInsert };
      webhooks: { Row: WebhookRow; Insert: WebhookInsert };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// ── Projects ──

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
export type ProjectInsert = Omit<ProjectRow, "id" | "created_at" | "updated_at">;

// ── Source Files (references to Supabase Storage) ──

export type SourceFileStatus = "raw" | "profiling" | "profiled" | "cleaning" | "clean" | "error";

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
  cleaned_path: string | null;
  status: SourceFileStatus;
}
export type SourceFileInsert = Omit<SourceFileRow, "id" | "uploaded_at">;

// ── Source Profiles (column-level metadata) ──

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

// ── Field Mappings ──

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

// ── Pipeline State ──

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

// ── Semantic Layer (describes Parquet files in Storage) ──

export interface SemanticEntityRow {
  id: string;
  project_id: string;
  entity_name: string;
  description: string | null;
  parquet_path: string;
  row_count: number | null;
  created_from: string[];
  updated_at: string;
}
export type SemanticEntityInsert = Omit<SemanticEntityRow, "id" | "updated_at">;

export interface SemanticFieldRow {
  id: string;
  entity_id: string;
  field_name: string;
  data_type: string;
  description: string | null;
}
export type SemanticFieldInsert = Omit<SemanticFieldRow, "id">;

export interface SemanticJoinRow {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  join_column: string;
}
export type SemanticJoinInsert = Omit<SemanticJoinRow, "id">;

// ── Dashboard ──

export interface PinnedWidgetRow {
  id: string;
  project_id: string;
  title: string;
  query_text: string;
  query_code: string;
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

// ── Conversations ──

export interface ConversationRow {
  id: string;
  project_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}
export type ConversationInsert = Omit<ConversationRow, "id" | "created_at" | "updated_at">;

export interface ConversationMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls: Record<string, unknown> | null;
  tool_results: Record<string, unknown> | null;
  artifacts: Record<string, unknown> | null;
  created_at: string;
}
export type ConversationMessageInsert = Omit<ConversationMessageRow, "id" | "created_at">;

// ── Webhooks ──

export type WebhookPayloadType = "json" | "file" | "both";

export interface WebhookRow {
  id: string;
  project_id: string;
  node_id: string;
  name: string;
  api_key: string;
  hmac_secret: string | null;
  payload_type: WebhookPayloadType;
  is_active: boolean;
  created_at: string;
  last_triggered_at: string | null;
  trigger_count: number;
}
export type WebhookInsert = Omit<WebhookRow, "id" | "created_at" | "last_triggered_at" | "trigger_count">;
