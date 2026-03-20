import { getModel } from "../config/ai.js";
import { generateText } from "ai";
import { supabase } from "../config/supabase.js";
import { AIServiceError, NotFoundError } from "../lib/errors.js";
import type { FieldMappingRow, FieldMappingInsert } from "../lib/types/database.js";

interface TargetTable {
  name: string;
  description?: string;
  columns: Array<{ name: string; type: string; description?: string; required?: boolean }>;
}

async function getProjectSchema(projectId: string): Promise<string> {
  const { data } = await supabase
    .from("target_schemas")
    .select("tables")
    .eq("project_id", projectId)
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    throw new Error(
      "No active target schema for this project. " +
      "Propose and activate a schema before mapping.",
    );
  }

  const tables = data.tables as TargetTable[];
  return tables
    .map((t) => `${t.name}: ${t.columns.map((c) => c.name).join(", ")}`)
    .join("\n");
}

function buildMappingPrompt(schemaText: string): string {
  return `You are a data mapping assistant for CareMap.

Given source column profiles (with inferred types, semantic labels, sample values) and the target data model, propose a mapping for each source column.

For each column provide:
- sourceColumn: exact column name from the source
- targetTable: which target table this maps to
- targetColumn: which column in that table
- confidence: 0-1 score
- reasoning: one-sentence plain-language explanation of why this mapping makes sense
- transformation: SQL expression if a transformation is needed (e.g., "CAST(value AS INTEGER)", "value * 0.0113"), or null if direct copy

Column names may be in any language. Translate and consider domain context when mapping.

Return valid JSON array:
[{ "sourceColumn": "...", "targetTable": "...", "targetColumn": "...", "confidence": 0.92, "reasoning": "...", "transformation": null }, ...]

Target data model tables and columns:

${schemaText}`;
}

interface SourceColumnContext {
  columnName: string;
  inferredType: string;
  semanticLabel: string | null;
  domain: string | null;
  confidence: number;
  sampleValues: unknown[];
}

export async function generateMappings(
  projectId: string,
  sourceFileId: string,
  columnProfiles: SourceColumnContext[],
): Promise<FieldMappingRow[]> {
  const schemaText = await getProjectSchema(projectId);

  const { text: content } = await generateText({
    model: getModel(),
    messages: [
      { role: "system", content: buildMappingPrompt(schemaText) },
      {
        role: "user",
        content: `Source columns:\n${JSON.stringify(columnProfiles, null, 2)}`,
      },
    ],
    temperature: 0.1,
  });

  if (!content) throw new AIServiceError("Empty response from mapping model");

  const parsed = JSON.parse(content) as { mappings?: MappingResult[] } | MappingResult[];
  const mappings: MappingResult[] = Array.isArray(parsed) ? parsed : (parsed.mappings ?? []);

  const inserts: FieldMappingInsert[] = mappings.map((m) => ({
    project_id: projectId,
    source_file_id: sourceFileId,
    source_column: m.sourceColumn,
    target_table: m.targetTable,
    target_column: m.targetColumn,
    confidence: m.confidence,
    reasoning: m.reasoning,
    transformation: m.transformation ?? null,
    status: m.confidence >= 0.85 ? "accepted" : "pending",
    reviewed_by: m.confidence >= 0.85 ? "auto" : null,
    reviewed_at: m.confidence >= 0.85 ? new Date().toISOString() : null,
  }));

  const { data, error } = await supabase.from("field_mappings").insert(inserts).select();
  if (error) throw new Error(`Failed to save mappings: ${error.message}`);
  return data as FieldMappingRow[];
}

interface MappingResult {
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  confidence: number;
  reasoning: string;
  transformation: string | null;
}

export async function updateMappingStatus(
  mappingId: string,
  updates: Partial<Pick<FieldMappingRow, "status" | "target_table" | "target_column" | "transformation">>,
): Promise<FieldMappingRow> {
  const { data, error } = await supabase
    .from("field_mappings")
    .update({
      ...updates,
      reviewed_by: "user",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", mappingId)
    .select()
    .single();

  if (error) throw new NotFoundError("FieldMapping", mappingId);
  return data as FieldMappingRow;
}

export async function getMappingsByProject(
  projectId: string,
  opts?: { from?: number; to?: number },
): Promise<{ data: FieldMappingRow[]; total: number }> {
  let query = supabase
    .from("field_mappings")
    .select("*", { count: "exact" })
    .eq("project_id", projectId)
    .order("confidence", { ascending: false });

  if (opts?.from !== undefined && opts?.to !== undefined) {
    query = query.range(opts.from, opts.to);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch mappings: ${error.message}`);
  return { data: data as FieldMappingRow[], total: count ?? 0 };
}
