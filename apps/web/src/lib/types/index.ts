import type { Node, Edge } from "@xyflow/react";

export type NodeCategory = "source" | "transform" | "quality" | "sink";
export type NodeStatus = "ready" | "running" | "warning" | "error" | "idle";
export type FileType = "csv" | "xlsx" | "pdf" | "txt";
export type MappingStatus = "pending" | "accepted" | "rejected";
export type TargetColumnStatus = "mapped" | "partial" | "gap" | "derived";
export type AlertSeverity = "critical" | "warning" | "info";

export interface PipelineNodeData extends Record<string, unknown> {
  category: NodeCategory;
  status: NodeStatus;
  label: string;
  sourceFileId?: string;
  rowCount?: number;
  columnCount?: number;
  mappedCount?: number;
  /** Source-specific */
  fileType?: FileType;
  domain?: string;
  description?: string;
  /** Mapping-specific */
  sourceCount?: number;
  totalFields?: number;
  confidenceAvg?: number;
  /** Quality-specific */
  checksPass?: number;
  checksWarn?: number;
  checksFail?: number;
  /** Sink-specific */
  targetTable?: string;
  lastSyncAt?: string;
  /** Issue indicator — count of problems requiring attention */
  issueCount?: number;
}

export type PipelineNode = Node<PipelineNodeData>;
export type PipelineEdge = Edge;

export interface SourceFile {
  id: string;
  filename: string;
  fileType: FileType;
  uploadedAt: string;
  rowCount: number;
  columnCount: number;
  status: NodeStatus;
  domain: string;
}

export interface ColumnProfile {
  id: string;
  sourceFileId: string;
  columnName: string;
  inferredType: "string" | "number" | "date" | "code";
  semanticLabel: string;
  domain: string;
  confidence: number;
  sampleValues: (string | number)[];
  qualityFlags: string[];
  userCorrected: boolean;
}

export interface FieldMapping {
  id: string;
  sourceFileId: string;
  sourceColumn: string;
  sampleValue?: string;
  targetTable: string;
  targetColumn: string;
  confidence: number;
  reasoning: string;
  status: MappingStatus;
  transformation?: string;
}

export interface TargetColumn {
  column: string;
  dataType: string;
  required: boolean;
  description: string;
  status: TargetColumnStatus;
  sourceMapping?: {
    sourceFileId: string;
    sourceColumn: string;
    sampleValue?: string;
    confidence: number;
    transformation?: string;
    reasoning: string;
    mappingStatus: MappingStatus;
  };
  derivedValue?: string;
}

export interface TargetTableMapping {
  targetTable: string;
  label: string;
  sourceFileIds: string[];
  columns: TargetColumn[];
  joinKeys: JoinKey[];
}

export interface JoinKey {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  sharedSourceColumn: string;
  confidence: number;
}

export interface AffectedRecord {
  rowIndex: number;
  values: Record<string, string | number | null>;
  anomalousFields: string[];
}

export interface QualityAlert {
  id: string;
  severity: AlertSeverity;
  summary: string;
  sourceFileId?: string;
  affectedCount: number;
  detectionMethod?: string;
  acknowledged: boolean;
  createdAt: string;
  timestamp?: string;
  affectedRecords?: AffectedRecord[];
}

export interface PlanStep {
  label: string;
  completed: boolean;
}

export interface ScanDetails {
  tables: string[];
  joinConditions: string[];
  filters: string[];
}

export interface ExecutionDetails {
  sql: string;
  tablesUsed: string[];
  rowCount: number;
  executionTimeMs: number;
  dataFreshness: string;
}

export interface ChartSpec {
  type: "bar" | "line" | "pie" | "heatmap";
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color?: string;
}

export type ToolStepStatus = "running" | "success" | "error";

export interface ToolStep {
  id: string;
  icon: "search" | "edit" | "chart" | "table" | "check";
  label: string;
  entities?: EntityRef[];
  status: ToolStepStatus;
  durationMs?: number;
  detail?: string;
}

export interface EntityRef {
  id: string;
  type: "table" | "column" | "source" | "chart";
  label: string;
  hash?: string;
}

export interface ArtifactTab {
  id: string;
  type: "overview" | "table" | "chart";
  label: string;
  hash?: string;
  content?: string;
  chartSpec?: ChartSpec;
  tableData?: {
    columns: string[];
    rows: (string | number | null)[][];
  };
}

export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  entities?: EntityRef[];
  toolSteps?: ToolStep[];
  artifacts?: ArtifactTab[];
  chartSpec?: ChartSpec;
  planSteps?: PlanStep[];
  scanDetails?: ScanDetails;
  executionDetails?: ExecutionDetails;
  approval?: {
    status: "pending" | "accepted" | "rejected";
    label: string;
  };
}

export interface PinnedWidget {
  id: string;
  title: string;
  queryText: string;
  sqlQuery: string;
  chartSpec: ChartSpec;
  pinnedAt: string;
  lastRefreshedAt?: string;
}

/** Matches GET /api/dashboard → sources[] contract */
export interface DashboardSourceSummary {
  id: string;
  filename: string;
  fileType: FileType;
  status: NodeStatus;
  rowCount: number;
  columnCount: number;
  mappedFields: number;
  unmappedFields: number;
  lastSyncAt: string;
  uploadedAt: string;
  domain: string;
}

export interface DashboardKpis {
  totalSources: number;
  totalRowsHarmonized: number;
  fieldsMapped: number;
  fieldsTotal: number;
  dataCompleteness: number;
  openAlerts: number;
}

/** Heatmap data returned by backend, or assembled client-side from profiles */
export interface CompletenessData {
  fields: string[];
  buckets: string[];
  /** field → bucket → fill-rate percentage (0–100) */
  values: Record<string, Record<string, number>>;
}

export interface LineageEntry {
  metricLabel: string;
  sourceFileId: string;
  sourceColumn: string;
  transformations: string[];
  targetField: string;
}

export interface CorrectionEntry {
  id: string;
  timestamp: string;
  action: "mapping_change" | "value_fix" | "schema_update" | "field_rename";
  description: string;
  sourceFileId?: string;
  field?: string;
  previousValue?: string;
  newValue?: string;
  appliedBy: "ai" | "user";
}

export interface SemanticEntity {
  id: string;
  entityName: string;
  description: string;
  sqlTableName: string;
  fields: SemanticField[];
}

export interface SemanticField {
  name: string;
  sqlExpression: string;
  dataType: string;
  description: string;
}

export interface SemanticJoin {
  fromEntity: string;
  toEntity: string;
  joinSql: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

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
