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
  createdAt: string;
  updatedAt: string;
}
