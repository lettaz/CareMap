import Papa from "papaparse";
import { ai, getModelId } from "../config/ai.js";
import { supabase } from "../config/supabase.js";
import { AIServiceError } from "../lib/errors.js";
import type { SourceProfileRow } from "../lib/types/database.js";
import type { ProfileColumnEvent, ProfileCompleteEvent } from "../lib/types/api.js";

interface ParseResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export function parseCsv(content: string): ParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  return {
    columns: parsed.meta.fields ?? [],
    rows: parsed.data,
    rowCount: parsed.data.length,
  };
}

const PROFILE_SYSTEM_PROMPT = `You are a clinical data profiling assistant for CareMap, a healthcare data harmonization platform.

Given column names and sample rows from a healthcare dataset, analyze each column and return a JSON array.

For each column provide:
- columnName: exact column name from the source
- inferredType: one of "string", "number", "date", "code"
- semanticLabel: a human-readable clinical label in English (e.g., "Fall Risk Score", "Patient ID")
- domain: the clinical domain this column belongs to (e.g., "care_assessments", "lab_results", "vital_signs", "medications", "encounters", "patients", "staff_schedules", "sensor_readings")
- confidence: 0-1 score of how confident you are in the mapping
- qualityFlags: array of issues detected (e.g., "high_null_rate", "mixed_types", "outlier_values", "inconsistent_format")

Also provide an overall assessment:
- suggestedLabel: a descriptive name for the entire dataset
- domain: primary clinical domain
- overallQuality: "good", "fair", or "poor"

Column names may be in German. Translate and interpret accordingly.

Return valid JSON with this structure:
{
  "columns": [...],
  "suggestedLabel": "...",
  "domain": "...",
  "overallQuality": "good|fair|poor"
}`;

export async function profileColumns(
  columns: string[],
  sampleRows: Record<string, unknown>[],
): Promise<{ columns: ProfileColumnEvent[]; summary: ProfileCompleteEvent }> {
  const sample = sampleRows.slice(0, 10);

  const response = await ai.chat.completions.create({
    model: getModelId(),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PROFILE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Columns: ${JSON.stringify(columns)}\n\nSample rows (first 10):\n${JSON.stringify(sample, null, 2)}`,
      },
    ],
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new AIServiceError("Empty response from profiling model");

  const result = JSON.parse(content) as {
    columns: ProfileColumnEvent[];
    suggestedLabel: string;
    domain: string;
    overallQuality: "good" | "fair" | "poor";
  };

  return {
    columns: result.columns,
    summary: {
      suggestedLabel: result.suggestedLabel,
      domain: result.domain,
      overallQuality: result.overallQuality,
    },
  };
}

export async function saveProfiles(
  sourceFileId: string,
  profiles: ProfileColumnEvent[],
): Promise<SourceProfileRow[]> {
  const rows = profiles.map((p) => ({
    source_file_id: sourceFileId,
    column_name: p.columnName,
    inferred_type: p.inferredType,
    semantic_label: p.semanticLabel,
    domain: p.domain,
    confidence: p.confidence,
    sample_values: p.sampleValues,
    quality_flags: p.qualityFlags,
    user_corrected: false,
  }));

  const { data, error } = await supabase.from("source_profiles").insert(rows).select();
  if (error) throw new Error(`Failed to save profiles: ${error.message}`);
  return data as SourceProfileRow[];
}
