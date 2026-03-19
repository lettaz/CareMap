import { z } from "zod";

// ── Projects ──

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export type CreateProjectBody = z.infer<typeof createProjectSchema>;

// ── Ingest (File Upload + Profiling) ──

export interface IngestStreamEvent {
  type: "parse_complete" | "profile_column" | "profile_complete";
  data: ParseCompleteEvent | ProfileColumnEvent | ProfileCompleteEvent;
}

export interface ParseCompleteEvent {
  rowCount: number;
  columns: string[];
  sourceFileId: string;
}

export interface ProfileColumnEvent {
  columnName: string;
  inferredType: string;
  semanticLabel: string;
  domain: string;
  confidence: number;
  sampleValues: unknown[];
  qualityFlags: string[];
}

export interface ProfileCompleteEvent {
  overallQuality: "good" | "fair" | "poor";
  suggestedLabel: string;
  domain: string;
}

// ── Mappings ──

export const generateMappingsSchema = z.object({
  sourceNodeIds: z.array(z.string().uuid()).min(1),
});

export type GenerateMappingsBody = z.infer<typeof generateMappingsSchema>;

export const updateMappingSchema = z.object({
  status: z.enum(["pending", "accepted", "rejected"]).optional(),
  targetTable: z.string().optional(),
  targetColumn: z.string().optional(),
  transformation: z.string().nullable().optional(),
});

export type UpdateMappingBody = z.infer<typeof updateMappingSchema>;

// ── Harmonize ──

export const harmonizeSchema = z.object({
  mappingIds: z.array(z.string().uuid()).min(1),
  sourceFileId: z.string().uuid(),
});

export type HarmonizeBody = z.infer<typeof harmonizeSchema>;

export interface HarmonizeResult {
  recordsWritten: number;
  errors: Array<{ row: number; message: string }>;
  qualityAlerts: Array<{ severity: string; summary: string; affectedCount: number }>;
}

// ── Chat ──

export const chatMessageSchema = z.object({
  role: z.enum(["user", "agent"]),
  content: z.string().min(1),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  projectId: z.string().uuid(),
});

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

// ── Dashboard ──

export interface DashboardResponse {
  widgets: Array<{
    id: string;
    title: string;
    queryText: string;
    chartSpec: Record<string, unknown>;
    pinnedAt: string;
  }>;
  alerts: Array<{
    id: string;
    severity: string;
    summary: string;
    affectedCount: number;
    acknowledged: boolean;
    createdAt: string;
  }>;
  sources: Array<{
    id: string;
    filename: string;
    rowCount: number;
    mappedFields: number;
    unmappedFields: number;
  }>;
}
