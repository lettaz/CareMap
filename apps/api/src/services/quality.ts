import { supabase } from "../config/supabase.js";
import type { QualityAlertRow } from "../lib/types/database.js";

interface QualityCheckResult {
  alerts: QualityAlertRow[];
  stats: {
    totalColumns: number;
    columnsWithIssues: number;
    overallCompleteness: number;
  };
}

export async function runQualityCheck(
  projectId: string,
  sourceFileId: string,
): Promise<QualityCheckResult> {
  const { data: profiles, error } = await supabase
    .from("source_profiles")
    .select()
    .eq("source_file_id", sourceFileId);

  if (error) throw new Error(`Failed to fetch profiles: ${error.message}`);
  if (!profiles?.length) return { alerts: [], stats: { totalColumns: 0, columnsWithIssues: 0, overallCompleteness: 1 } };

  const alerts: QualityAlertRow[] = [];
  let columnsWithIssues = 0;

  for (const profile of profiles) {
    const flags: string[] = (profile.quality_flags as string[]) ?? [];
    if (flags.length === 0) continue;

    columnsWithIssues++;

    for (const flag of flags) {
      const severity = flagToSeverity(flag);
      const summary = flagToSummary(flag, profile.column_name);

      const { data: alert } = await supabase
        .from("quality_alerts")
        .insert({
          project_id: projectId,
          severity,
          summary,
          source_file_id: sourceFileId,
          affected_count: 0,
          detection_method: `profile_flag:${flag}`,
          acknowledged: false,
        })
        .select()
        .single();

      if (alert) alerts.push(alert as QualityAlertRow);
    }
  }

  return {
    alerts,
    stats: {
      totalColumns: profiles.length,
      columnsWithIssues,
      overallCompleteness: profiles.length > 0 ? (profiles.length - columnsWithIssues) / profiles.length : 1,
    },
  };
}

function flagToSeverity(flag: string): "critical" | "warning" | "info" {
  const critical = ["high_null_rate", "duplicate_rows", "data_type_mismatch"];
  const warning = ["mixed_types", "outlier_values", "inconsistent_format"];

  if (critical.includes(flag)) return "critical";
  if (warning.includes(flag)) return "warning";
  return "info";
}

function flagToSummary(flag: string, columnName: string): string {
  const summaries: Record<string, string> = {
    high_null_rate: `Column '${columnName}' has a high rate of missing values`,
    mixed_types: `Column '${columnName}' contains mixed data types`,
    outlier_values: `Column '${columnName}' contains outlier values outside expected range`,
    inconsistent_format: `Column '${columnName}' has inconsistent formatting`,
    duplicate_rows: `Potential duplicate rows detected involving '${columnName}'`,
    data_type_mismatch: `Column '${columnName}' has values that don't match the inferred type`,
  };
  return summaries[flag] ?? `Quality issue '${flag}' detected in column '${columnName}'`;
}

export async function getAlertsByProject(projectId: string): Promise<QualityAlertRow[]> {
  const { data, error } = await supabase
    .from("quality_alerts")
    .select()
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch alerts: ${error.message}`);
  return data as QualityAlertRow[];
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  await supabase.from("quality_alerts").update({ acknowledged: true }).eq("id", alertId);
}
