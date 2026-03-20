import { supabase } from "../config/supabase.js";

type CorrectionAction = "mapping_change" | "value_fix" | "schema_update" | "field_rename";

interface LogCorrectionParams {
  projectId: string;
  action: CorrectionAction;
  description: string;
  sourceFileId?: string;
  field?: string;
  previousValue?: string;
  newValue?: string;
  appliedBy?: "ai" | "user";
}

export async function logCorrection(params: LogCorrectionParams): Promise<void> {
  try {
    await supabase.from("corrections_log").insert({
      project_id: params.projectId,
      action: params.action,
      description: params.description,
      source_file_id: params.sourceFileId ?? null,
      field: params.field ?? null,
      previous_value: params.previousValue ?? null,
      new_value: params.newValue ?? null,
      applied_by: params.appliedBy ?? "ai",
    });
  } catch {
    // Non-critical — table may not exist yet
  }
}

export async function logBulkCorrections(entries: LogCorrectionParams[]): Promise<void> {
  if (!entries.length) return;

  try {
    await supabase.from("corrections_log").insert(
      entries.map((e) => ({
        project_id: e.projectId,
        action: e.action,
        description: e.description,
        source_file_id: e.sourceFileId ?? null,
        field: e.field ?? null,
        previous_value: e.previousValue ?? null,
        new_value: e.newValue ?? null,
        applied_by: e.appliedBy ?? "ai",
      })),
    );
  } catch {
    // Non-critical
  }
}
