import { supabase } from "../config/supabase.js";
import { ValidationError } from "../lib/errors.js";
import type { FieldMappingRow } from "../lib/types/database.js";
import type { HarmonizeResult } from "../lib/types/api.js";

interface SourceRow {
  [column: string]: unknown;
}

export async function harmonize(
  mappingIds: string[],
  sourceFileId: string,
): Promise<HarmonizeResult> {
  const { data: mappings, error: mapErr } = await supabase
    .from("field_mappings")
    .select()
    .in("id", mappingIds)
    .eq("status", "accepted");

  if (mapErr) throw new Error(`Failed to fetch mappings: ${mapErr.message}`);
  if (!mappings?.length) throw new ValidationError("No accepted mappings found for the given IDs");

  const { data: sourceFile, error: sfErr } = await supabase
    .from("source_files")
    .select("storage_path, row_count")
    .eq("id", sourceFileId)
    .single();

  if (sfErr || !sourceFile) throw new ValidationError("Source file not found");

  // Group mappings by target table
  const byTable = groupMappingsByTable(mappings as FieldMappingRow[]);

  const errors: HarmonizeResult["errors"] = [];
  let totalWritten = 0;

  // TODO: Load actual source data from Supabase Storage
  // For now, this is the integration point where raw CSV data
  // will be loaded and transformed row-by-row using the mappings.
  //
  // The flow:
  // 1. Download raw file from Supabase Storage using sourceFile.storage_path
  // 2. Parse with PapaParse
  // 3. For each target table:
  //    a. Apply column renames from mapping (sourceColumn → targetColumn)
  //    b. Apply transformations (SQL expressions or simple type casts)
  //    c. Batch insert into canonical table
  //    d. Record provenance (source_file_id on each row)
  // 4. Run quality checks on inserted data
  // 5. Generate quality alerts for anomalies

  for (const [targetTable, tableMappings] of Object.entries(byTable)) {
    const result = await writeToCanonicalTable(targetTable, tableMappings, [], sourceFileId);
    totalWritten += result.written;
    errors.push(...result.errors);
  }

  const qualityAlerts = await runPostHarmonizationChecks(sourceFileId, mappings as FieldMappingRow[]);

  return {
    recordsWritten: totalWritten,
    errors,
    qualityAlerts,
  };
}

function groupMappingsByTable(mappings: FieldMappingRow[]): Record<string, FieldMappingRow[]> {
  const grouped: Record<string, FieldMappingRow[]> = {};
  for (const m of mappings) {
    const list = grouped[m.target_table] ?? [];
    list.push(m);
    grouped[m.target_table] = list;
  }
  return grouped;
}

async function writeToCanonicalTable(
  _targetTable: string,
  _mappings: FieldMappingRow[],
  _sourceRows: SourceRow[],
  _sourceFileId: string,
): Promise<{ written: number; errors: Array<{ row: number; message: string }> }> {
  // TODO: Implement row-by-row transformation and batch insert.
  //
  // For each source row:
  // 1. Create a target row object using mapping.target_column as key
  // 2. Apply mapping.transformation if present (parse and execute SQL-like expression)
  // 3. Add source_file_id for provenance
  // 4. Collect into batch array
  //
  // Then batch insert into supabase.from(targetTable).insert(batch)
  return { written: 0, errors: [] };
}

async function runPostHarmonizationChecks(
  _sourceFileId: string,
  _mappings: FieldMappingRow[],
): Promise<HarmonizeResult["qualityAlerts"]> {
  // TODO: After data is written to canonical tables, run:
  // 1. Null rate checks per column
  // 2. Value range checks (e.g., lab results within reference ranges)
  // 3. Duplicate detection
  // 4. Format consistency checks
  //
  // Generate quality_alerts rows in Supabase for each issue found.
  return [];
}
