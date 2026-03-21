import { supabase } from "../config/supabase.js";
import { parseCsv, parseExcel, profileColumns, saveProfiles } from "./profiler.js";
import { uploadFile, rawPath } from "./storage.js";
import { logStep } from "../lib/step-logger.js";

export interface IngestOptions {
  projectId: string;
  nodeId: string;
  filename: string;
  buffer: Buffer;
  fileType: "csv" | "tsv" | "xlsx" | "webhook-json";
  onProgress?: (type: string, data: unknown) => void;
}

export interface IngestResult {
  sourceFileId: string;
  rowCount: number;
  columnCount: number;
  suggestedLabel: string;
  overallQuality: string;
  avgConfidence: number;
  criticalFlagCount: number;
}

export async function ingestBuffer(opts: IngestOptions): Promise<IngestResult> {
  const { projectId, nodeId, filename, buffer, fileType, onProgress } = opts;
  const emit = onProgress ?? (() => {});

  const parseStep = await logStep({
    projectId,
    nodeId,
    stepType: "parse_file",
    inputSummary: { filename, fileType, sizeBytes: buffer.length },
  });
  emit("step", { stepType: "parse_file", status: "running" });

  const isExcel = fileType === "xlsx";
  const isTsv = fileType === "tsv";

  const parsed = isExcel
    ? parseExcel(buffer)
    : parseCsv(buffer.toString("utf-8"), isTsv ? "\t" : undefined);

  const parseOutput = {
    rowCount: parsed.rowCount,
    columnCount: parsed.columns.length,
    columns: parsed.columns,
    renames: parsed.renames,
  };
  await parseStep.finish(parseOutput);
  emit("step", { stepType: "parse_file", status: "completed", output: parseOutput });

  const { data: sourceFile, error: sfErr } = await supabase
    .from("source_files")
    .insert({
      project_id: projectId,
      filename,
      file_type: fileType,
      row_count: parsed.rowCount,
      column_count: parsed.columns.length,
      storage_path: null,
      cleaned_path: null,
      raw_profile: null,
      status: "raw",
    })
    .select()
    .single();

  if (sfErr || !sourceFile) {
    throw new Error(`Failed to create source file record: ${sfErr?.message}`);
  }

  const storagePath = rawPath(projectId, sourceFile.id);
  const uploadMime = isExcel
    ? "application/octet-stream"
    : isTsv
      ? "text/tab-separated-values"
      : "text/csv";
  await uploadFile(storagePath, buffer, uploadMime);
  await supabase.from("source_files").update({ storage_path: storagePath }).eq("id", sourceFile.id);

  await supabase
    .from("pipeline_nodes")
    .update({ config: { sourceFileId: sourceFile.id }, status: "profiling" })
    .eq("id", nodeId);

  emit("parse_complete", {
    rowCount: parsed.rowCount,
    columns: parsed.columns,
    sourceFileId: sourceFile.id,
  });

  const statsStep = await logStep({
    projectId,
    nodeId,
    sourceFileId: sourceFile.id,
    stepType: "compute_stats",
    inputSummary: { columnCount: parsed.columns.length, rowCount: parsed.rowCount },
  });
  emit("step", { stepType: "compute_stats", status: "running" });

  const profile = await profileColumns(parsed.columns, parsed.rows, parsed.renames);

  const statsOutput = profile.stats.map((s) => ({
    columnName: s.columnName,
    detectedType: s.detectedType,
    nullRate: s.nullRate,
    uniqueCount: s.uniqueCount,
    uniqueRate: s.uniqueRate,
  }));
  await statsStep.finish({ columns: statsOutput });
  emit("step", { stepType: "compute_stats", status: "completed", output: { columnCount: statsOutput.length } });

  const llmStep = await logStep({
    projectId,
    nodeId,
    sourceFileId: sourceFile.id,
    stepType: "llm_interpret",
    inputSummary: { columnCount: parsed.columns.length, model: "gpt-5.2-codex" },
  });
  await llmStep.finish({
    suggestedLabel: profile.summary.suggestedLabel,
    domain: profile.summary.domain,
    overallQuality: profile.summary.overallQuality,
    columnsInterpreted: profile.columns.length,
  });
  emit("step", {
    stepType: "llm_interpret",
    status: "completed",
    output: {
      suggestedLabel: profile.summary.suggestedLabel,
      overallQuality: profile.summary.overallQuality,
    },
  });

  for (const col of profile.columns) {
    emit("profile_column", col);
  }

  const saveStep = await logStep({
    projectId,
    nodeId,
    sourceFileId: sourceFile.id,
    stepType: "save_profiles",
    inputSummary: { profileCount: profile.columns.length },
  });
  emit("step", { stepType: "save_profiles", status: "running" });

  await saveProfiles(sourceFile.id, profile.columns);

  await supabase
    .from("source_files")
    .update({
      raw_profile: { columns: profile.stats, summary: profile.summary } as unknown as Record<string, unknown>,
      status: "profiled",
    })
    .eq("id", sourceFile.id);

  await supabase
    .from("pipeline_nodes")
    .update({ status: "ready", label: profile.summary.suggestedLabel })
    .eq("id", nodeId);

  await saveStep.finish({ savedCount: profile.columns.length });
  emit("step", { stepType: "save_profiles", status: "completed", output: { savedCount: profile.columns.length } });

  const criticalFlags = ["high_null_rate", "duplicate_rows", "data_type_mismatch"];
  const avgConfidence =
    profile.columns.reduce((sum, c) => sum + c.confidence, 0) / (profile.columns.length || 1);
  const criticalFlagCount = profile.columns.filter((c) =>
    c.qualityFlags.some((f) => criticalFlags.includes(f)),
  ).length;

  emit("profile_complete", {
    ...profile.summary,
    avgConfidence,
    criticalFlagCount,
  });

  return {
    sourceFileId: sourceFile.id,
    rowCount: parsed.rowCount,
    columnCount: parsed.columns.length,
    suggestedLabel: profile.summary.suggestedLabel,
    overallQuality: profile.summary.overallQuality,
    avgConfidence,
    criticalFlagCount,
  };
}
