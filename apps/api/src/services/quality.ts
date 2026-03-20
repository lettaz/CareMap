import { supabase } from "../config/supabase.js";

interface ComputedAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  source_file_id: string | null;
  affected_count: number;
  detection_method: string;
  acknowledged: boolean;
  created_at: string;
}

/**
 * Fetches persisted alerts AND computes live alerts from current project state.
 * Live alerts cover: unmapped fields, low-confidence mappings, high null rates, stale sources.
 */
export async function getAlertsByProject(projectId: string): Promise<ComputedAlert[]> {
  const [persisted, liveAlerts] = await Promise.all([
    fetchPersistedAlerts(projectId),
    computeLiveAlerts(projectId),
  ]);

  const persistedIds = new Set(persisted.map((a) => a.detection_method));
  const deduped = liveAlerts.filter((a) => !persistedIds.has(a.detection_method));

  return [...persisted, ...deduped];
}

async function fetchPersistedAlerts(projectId: string): Promise<ComputedAlert[]> {
  const { data, error } = await supabase
    .from("quality_alerts")
    .select()
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as ComputedAlert[];
}

async function computeLiveAlerts(projectId: string): Promise<ComputedAlert[]> {
  const alerts: ComputedAlert[] = [];
  const now = new Date().toISOString();
  let counter = 0;
  const liveId = () => `live-${++counter}`;

  const [filesResult, mappingsResult] = await Promise.all([
    supabase.from("source_files").select("id, filename, status, row_count, raw_profile, uploaded_at").eq("project_id", projectId),
    supabase.from("field_mappings").select("id, source_file_id, source_column, target_column, confidence, status").eq("project_id", projectId),
  ]);

  const files = filesResult.data ?? [];
  const mappings = mappingsResult.data ?? [];

  const fileMap = new Map(files.map((f) => [f.id, f.filename]));

  // --- 1. Unmapped fields: source files with pending/rejected mappings ---
  const pendingByFile = new Map<string, number>();
  const rejectedByFile = new Map<string, number>();
  for (const m of mappings) {
    if (m.status === "pending") {
      pendingByFile.set(m.source_file_id, (pendingByFile.get(m.source_file_id) ?? 0) + 1);
    }
    if (m.status === "rejected") {
      rejectedByFile.set(m.source_file_id, (rejectedByFile.get(m.source_file_id) ?? 0) + 1);
    }
  }

  for (const [fileId, count] of pendingByFile) {
    const filename = fileMap.get(fileId) ?? "Unknown file";
    alerts.push({
      id: liveId(),
      severity: count > 5 ? "warning" : "info",
      summary: `${filename}: ${count} field mapping${count > 1 ? "s" : ""} pending review`,
      source_file_id: fileId,
      affected_count: count,
      detection_method: `pending_mappings:${fileId}`,
      acknowledged: false,
      created_at: now,
    });
  }

  for (const [fileId, count] of rejectedByFile) {
    const filename = fileMap.get(fileId) ?? "Unknown file";
    alerts.push({
      id: liveId(),
      severity: "warning",
      summary: `${filename}: ${count} field mapping${count > 1 ? "s" : ""} rejected — may need remapping`,
      source_file_id: fileId,
      affected_count: count,
      detection_method: `rejected_mappings:${fileId}`,
      acknowledged: false,
      created_at: now,
    });
  }

  // --- 2. Low-confidence mappings ---
  const lowConfidence = mappings.filter((m) => m.status === "accepted" && m.confidence < 0.6);
  if (lowConfidence.length > 0) {
    const grouped = new Map<string, typeof lowConfidence>();
    for (const m of lowConfidence) {
      const arr = grouped.get(m.source_file_id) ?? [];
      arr.push(m);
      grouped.set(m.source_file_id, arr);
    }

    for (const [fileId, fileMappings] of grouped) {
      const filename = fileMap.get(fileId) ?? "Unknown file";
      const avgConf = Math.round(
        (fileMappings.reduce((s, m) => s + m.confidence, 0) / fileMappings.length) * 100,
      );
      alerts.push({
        id: liveId(),
        severity: avgConf < 40 ? "critical" : "warning",
        summary: `${filename}: ${fileMappings.length} accepted mapping${fileMappings.length > 1 ? "s" : ""} with low confidence (avg ${avgConf}%)`,
        source_file_id: fileId,
        affected_count: fileMappings.length,
        detection_method: `low_confidence:${fileId}`,
        acknowledged: false,
        created_at: now,
      });
    }
  }

  // --- 3. High null rates from raw_profile ---
  type RawStat = { columnName?: string; nullRate?: number };
  type RawProfile = { columns?: RawStat[] };

  for (const file of files) {
    const raw = file.raw_profile as RawProfile | null;
    const stats = raw?.columns ?? [];
    const highNullCols = stats.filter((s) => (s.nullRate ?? 0) > 0.3);

    if (highNullCols.length > 0) {
      const worst = highNullCols.sort((a, b) => (b.nullRate ?? 0) - (a.nullRate ?? 0));
      const worstRate = Math.round((worst[0].nullRate ?? 0) * 100);
      alerts.push({
        id: liveId(),
        severity: worstRate > 50 ? "critical" : "warning",
        summary: `${file.filename}: ${highNullCols.length} column${highNullCols.length > 1 ? "s" : ""} with >30% missing values (worst: ${worst[0].columnName} at ${worstRate}%)`,
        source_file_id: file.id,
        affected_count: highNullCols.length,
        detection_method: `high_null:${file.id}`,
        acknowledged: false,
        created_at: now,
      });
    }
  }

  // --- 4. Stale/unprofiled sources ---
  const rawFiles = files.filter((f) => f.status === "raw");
  if (rawFiles.length > 0) {
    alerts.push({
      id: liveId(),
      severity: rawFiles.length > 3 ? "warning" : "info",
      summary: `${rawFiles.length} source file${rawFiles.length > 1 ? "s" : ""} uploaded but not yet profiled`,
      source_file_id: null,
      affected_count: rawFiles.length,
      detection_method: `unprofiled_sources`,
      acknowledged: false,
      created_at: now,
    });
  }

  // --- 5. Sources with errors ---
  const errorFiles = files.filter((f) => f.status === "error");
  for (const file of errorFiles) {
    alerts.push({
      id: liveId(),
      severity: "critical",
      summary: `${file.filename} is in an error state — re-upload or re-profile needed`,
      source_file_id: file.id,
      affected_count: 1,
      detection_method: `error_source:${file.id}`,
      acknowledged: false,
      created_at: now,
    });
  }

  // --- 6. Files with no mappings at all ---
  const filesWithMappings = new Set(mappings.map((m) => m.source_file_id));
  const profiledFiles = files.filter(
    (f) => (f.status === "profiled" || f.status === "clean") && !filesWithMappings.has(f.id),
  );
  if (profiledFiles.length > 0) {
    alerts.push({
      id: liveId(),
      severity: profiledFiles.length > 3 ? "warning" : "info",
      summary: `${profiledFiles.length} profiled source${profiledFiles.length > 1 ? "s" : ""} with no field mappings — data won't be harmonized`,
      source_file_id: null,
      affected_count: profiledFiles.length,
      detection_method: `no_mappings`,
      acknowledged: false,
      created_at: now,
    });
  }

  // --- 7. Profile-level quality flags (from source_profiles) ---
  const profileFileIds = files.map((f) => f.id);
  if (profileFileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("source_profiles")
      .select("source_file_id, column_name, quality_flags")
      .in("source_file_id", profileFileIds);

    if (profiles?.length) {
      const flagCounts = new Map<string, Map<string, number>>();
      for (const p of profiles) {
        const flags = (p.quality_flags as string[]) ?? [];
        for (const flag of flags) {
          if (!flagCounts.has(p.source_file_id)) {
            flagCounts.set(p.source_file_id, new Map());
          }
          const fileFlagMap = flagCounts.get(p.source_file_id)!;
          fileFlagMap.set(flag, (fileFlagMap.get(flag) ?? 0) + 1);
        }
      }

      for (const [fileId, flagMap] of flagCounts) {
        const filename = fileMap.get(fileId) ?? "Unknown";
        const totalIssues = [...flagMap.values()].reduce((a, b) => a + b, 0);
        const topFlags = [...flagMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([flag, count]) => `${flag.replace(/_/g, " ")} (${count})`);

        if (totalIssues > 0) {
          alerts.push({
            id: liveId(),
            severity: totalIssues > 10 ? "warning" : "info",
            summary: `${filename}: ${totalIssues} quality flag${totalIssues > 1 ? "s" : ""} detected — ${topFlags.join(", ")}`,
            source_file_id: fileId,
            affected_count: totalIssues,
            detection_method: `profile_flags:${fileId}`,
            acknowledged: false,
            created_at: now,
          });
        }
      }
    }
  }

  return alerts;
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  await supabase.from("quality_alerts").update({ acknowledged: true }).eq("id", alertId);
}

/**
 * Manually triggered quality check: scans all source files' profiles,
 * persists new alerts to the DB, and returns the persisted rows.
 */
export async function runManualQualityCheck(projectId: string) {
  const { data: files } = await supabase
    .from("source_files")
    .select("id, filename")
    .eq("project_id", projectId);

  if (!files?.length) return [];

  const { data: profiles } = await supabase
    .from("source_profiles")
    .select("source_file_id, column_name, quality_flags, confidence")
    .in("source_file_id", files.map((f) => f.id));

  if (!profiles?.length) return [];

  const fileMap = new Map(files.map((f) => [f.id, f.filename]));
  const persisted: ComputedAlert[] = [];

  for (const profile of profiles) {
    const flags = (profile.quality_flags as string[]) ?? [];
    if (flags.length === 0) continue;

    const filename = fileMap.get(profile.source_file_id) ?? "Unknown";

    for (const flag of flags) {
      const detectionKey = `manual_check:${profile.source_file_id}:${profile.column_name}:${flag}`;

      const { count } = await supabase
        .from("quality_alerts")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("detection_method", detectionKey);

      if ((count ?? 0) > 0) continue;

      const severity = flagToSeverity(flag);
      const summary = `${filename} → ${profile.column_name}: ${flag.replace(/_/g, " ")}`;

      const { data: alert } = await supabase
        .from("quality_alerts")
        .insert({
          project_id: projectId,
          severity,
          summary,
          source_file_id: profile.source_file_id,
          affected_count: 1,
          detection_method: detectionKey,
          acknowledged: false,
        })
        .select()
        .single();

      if (alert) persisted.push(alert as ComputedAlert);
    }
  }

  const { data: mappings } = await supabase
    .from("field_mappings")
    .select("id, source_file_id, source_column, target_column, confidence, status")
    .eq("project_id", projectId);

  if (mappings?.length) {
    const lowConf = mappings.filter((m) => m.status === "accepted" && m.confidence < 0.6);
    for (const m of lowConf) {
      const detectionKey = `manual_check:low_conf:${m.id}`;
      const { count } = await supabase
        .from("quality_alerts")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("detection_method", detectionKey);

      if ((count ?? 0) > 0) continue;

      const filename = fileMap.get(m.source_file_id) ?? "Unknown";
      const { data: alert } = await supabase
        .from("quality_alerts")
        .insert({
          project_id: projectId,
          severity: m.confidence < 0.4 ? "critical" : "warning",
          summary: `${filename}: mapping ${m.source_column} → ${m.target_column} has ${Math.round(m.confidence * 100)}% confidence`,
          source_file_id: m.source_file_id,
          affected_count: 1,
          detection_method: detectionKey,
          acknowledged: false,
        })
        .select()
        .single();

      if (alert) persisted.push(alert as ComputedAlert);
    }
  }

  return persisted;
}

function flagToSeverity(flag: string): "critical" | "warning" | "info" {
  const critical = ["high_null_rate", "duplicate_rows", "data_type_mismatch"];
  const warning = ["mixed_types", "outlier_values", "inconsistent_format"];
  if (critical.includes(flag)) return "critical";
  if (warning.includes(flag)) return "warning";
  return "info";
}
