import { getModel } from "../config/ai.js";
import { generateText } from "ai";
import { supabase } from "../config/supabase.js";
import { AIServiceError, NotFoundError } from "../lib/errors.js";
import type { FieldMappingRow, FieldMappingInsert } from "../lib/types/database.js";

const CANONICAL_SCHEMA = `Canonical clinical data model tables and columns:

patients: id, external_id, birth_year, gender
encounters: id, patient_id, type, ward, start_date, end_date
diagnoses: id, encounter_id, code, code_system, description, date
lab_results: id, encounter_id, test_code, test_name, value, unit, reference_range, measured_at
vital_signs: id, encounter_id, type, value, unit, measured_at
medications: id, encounter_id, drug_name, drug_code, dose, unit, frequency, start_date, end_date
care_assessments: id, encounter_id, patient_id, assessment_type, score, scale_min, scale_max, assessed_at, assessor
care_interventions: id, encounter_id, intervention_type, description, start_date, end_date, status
sensor_readings: id, patient_id, sensor_type, value, unit, measured_at
staff_schedules: id, staff_id, ward, role, shift_start, shift_end`;

const MAPPING_SYSTEM_PROMPT = `You are a clinical data mapping assistant for CareMap.

Given source column profiles (with inferred types, semantic labels, sample values) and the canonical clinical data model, propose a mapping for each source column.

For each column provide:
- sourceColumn: exact column name from the source
- targetTable: which canonical table this maps to
- targetColumn: which column in that table
- confidence: 0-1 score
- reasoning: one-sentence plain-language explanation of why this mapping makes sense
- transformation: SQL expression if a transformation is needed (e.g., "CAST(value AS INTEGER)", "value * 0.0113"), or null if direct copy

Column names may be in German. Consider clinical context when mapping.

Return valid JSON array:
[{ "sourceColumn": "...", "targetTable": "...", "targetColumn": "...", "confidence": 0.92, "reasoning": "...", "transformation": null }, ...]

${CANONICAL_SCHEMA}`;

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
  const { text: content } = await generateText({
    model: getModel(),
    messages: [
      { role: "system", content: MAPPING_SYSTEM_PROMPT },
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

export async function getMappingsByProject(projectId: string): Promise<FieldMappingRow[]> {
  const { data, error } = await supabase
    .from("field_mappings")
    .select()
    .eq("project_id", projectId)
    .order("confidence", { ascending: false });

  if (error) throw new Error(`Failed to fetch mappings: ${error.message}`);
  return data as FieldMappingRow[];
}
