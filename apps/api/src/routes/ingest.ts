import type { FastifyPluginAsync } from "fastify";
import { supabase } from "../config/supabase.js";
import { parseCsv, parseExcel, profileColumns, saveProfiles } from "../services/profiler.js";
import { uploadFile, rawPath, downloadFile, deleteFiles, cleanedPath } from "../services/storage.js";
import { ValidationError } from "../lib/errors.js";
import { logStep } from "../lib/step-logger.js";
import { env } from "../config/env.js";

function sseWrite(raw: { write: (chunk: string) => boolean }, type: string, data: unknown) {
  raw.write(`data: ${JSON.stringify({ type, data })}\n\n`);
}

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Querystring: { projectId: string; nodeId: string } }>("/", async (request, reply) => {
    const { projectId, nodeId } = request.query;
    if (!projectId || !nodeId) throw new ValidationError("projectId and nodeId are required");

    const file = await request.file();
    if (!file) throw new ValidationError("No file uploaded");

    const allowedMimes = [
      "text/csv",
      "text/plain",
      "text/tab-separated-values",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const isAllowed =
      allowedMimes.includes(file.mimetype) || /\.(csv|tsv|txt|xlsx|xls)$/i.test(file.filename);
    if (!isAllowed) throw new ValidationError("Unsupported file type. Accepted: CSV, TSV, TXT, XLSX");

    const buffer = await file.toBuffer();
    const isExcel = /\.(xlsx|xls)$/i.test(file.filename);
    const isTsv = /\.(tsv)$/i.test(file.filename);

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": env.CORS_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
    });

    // ── Step 1: Parse file ──
    const fileType = isExcel ? "xlsx" : isTsv ? "tsv" : "csv";
    const parseStep = await logStep({
      projectId, nodeId, stepType: "parse_file",
      inputSummary: { filename: file.filename, fileType, sizeBytes: buffer.length },
    });
    sseWrite(reply.raw, "step", { stepType: "parse_file", status: "running" });

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
    sseWrite(reply.raw, "step", { stepType: "parse_file", status: "completed", output: parseOutput });

    const { data: sourceFile, error: sfErr } = await supabase
      .from("source_files")
      .insert({
        project_id: projectId,
        filename: file.filename,
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

    if (sfErr || !sourceFile) throw new Error(`Failed to create source file record: ${sfErr?.message}`);

    const storagePath = rawPath(projectId, sourceFile.id);
    const uploadMime = isExcel ? "application/octet-stream" : isTsv ? "text/tab-separated-values" : "text/csv";
    await uploadFile(storagePath, buffer, uploadMime);
    await supabase.from("source_files").update({ storage_path: storagePath }).eq("id", sourceFile.id);

    await supabase
      .from("pipeline_nodes")
      .update({ config: { sourceFileId: sourceFile.id }, status: "profiling" })
      .eq("id", nodeId);

    sseWrite(reply.raw, "parse_complete", {
      rowCount: parsed.rowCount, columns: parsed.columns, sourceFileId: sourceFile.id,
    });

    try {
      // ── Step 2: Compute native statistics ──
      const statsStep = await logStep({
        projectId, nodeId, sourceFileId: sourceFile.id, stepType: "compute_stats",
        inputSummary: { columnCount: parsed.columns.length, rowCount: parsed.rowCount },
      });
      sseWrite(reply.raw, "step", { stepType: "compute_stats", status: "running" });

      // ── Step 3: LLM semantic interpretation (profileColumns does both compute + LLM) ──
      const profile = await profileColumns(parsed.columns, parsed.rows, parsed.renames);

      const statsOutput = profile.stats.map((s) => ({
        columnName: s.columnName,
        detectedType: s.detectedType,
        nullRate: s.nullRate,
        uniqueCount: s.uniqueCount,
        uniqueRate: s.uniqueRate,
      }));
      await statsStep.finish({ columns: statsOutput });
      sseWrite(reply.raw, "step", { stepType: "compute_stats", status: "completed", output: { columnCount: statsOutput.length } });

      const llmStep = await logStep({
        projectId, nodeId, sourceFileId: sourceFile.id, stepType: "llm_interpret",
        inputSummary: { columnCount: parsed.columns.length, model: "gpt-5.2-codex" },
      });
      await llmStep.finish({
        suggestedLabel: profile.summary.suggestedLabel,
        domain: profile.summary.domain,
        overallQuality: profile.summary.overallQuality,
        columnsInterpreted: profile.columns.length,
      });
      sseWrite(reply.raw, "step", {
        stepType: "llm_interpret", status: "completed",
        output: { suggestedLabel: profile.summary.suggestedLabel, overallQuality: profile.summary.overallQuality },
      });

      for (const col of profile.columns) {
        sseWrite(reply.raw, "profile_column", col);
      }

      // ── Step 4: Save profiles ──
      const saveStep = await logStep({
        projectId, nodeId, sourceFileId: sourceFile.id, stepType: "save_profiles",
        inputSummary: { profileCount: profile.columns.length },
      });
      sseWrite(reply.raw, "step", { stepType: "save_profiles", status: "running" });

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
      sseWrite(reply.raw, "step", { stepType: "save_profiles", status: "completed", output: { savedCount: profile.columns.length } });

      sseWrite(reply.raw, "profile_complete", profile.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Profiling failed";
      sseWrite(reply.raw, "step", { stepType: "error", status: "error", output: { message } });
      sseWrite(reply.raw, "error", { message });

      await supabase.from("source_files").update({ status: "error" }).eq("id", sourceFile.id);
      await supabase.from("pipeline_nodes").update({ status: "error" }).eq("id", nodeId);
    }

    reply.raw.end();
  });

  // ── Get sample rows for a source file (paginated) ──
  app.get<{ Params: { sourceFileId: string }; Querystring: { page?: string; pageSize?: string } }>(
    "/:sourceFileId/sample-rows",
    async (request) => {
      const { sourceFileId } = request.params;
      const page = Math.max(1, Number(request.query.page) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(request.query.pageSize) || 20));

      const { data: file, error } = await supabase
        .from("source_files")
        .select("project_id, file_type, storage_path")
        .eq("id", sourceFileId)
        .single();

      if (error || !file) throw new Error("Source file not found");
      if (!file.storage_path) return { data: [], total: 0, page, pageSize };

      const buffer = await downloadFile(file.storage_path);
      const isExcel = file.file_type === "xlsx" || file.file_type === "xls";
      const isTsv = file.file_type === "tsv";

      const parsed = isExcel
        ? parseExcel(buffer)
        : parseCsv(buffer.toString("utf-8"), isTsv ? "\t" : undefined);

      const total = parsed.rows.length;
      const from = (page - 1) * pageSize;
      const sliced = parsed.rows.slice(from, from + pageSize);

      return { data: sliced, total, page, pageSize };
    },
  );

  // ── Get profile for a source file ──
  app.get<{ Params: { sourceFileId: string } }>("/:sourceFileId/profile", async (request) => {
    const { sourceFileId } = request.params;
    const { data, error } = await supabase
      .from("source_profiles")
      .select()
      .eq("source_file_id", sourceFileId)
      .order("column_name");

    if (error) throw new Error(`Failed to fetch profiles: ${error.message}`);
    return data;
  });

  // ── Get detailed profile: native stats + LLM interpretation side by side ──
  app.get<{ Params: { sourceFileId: string } }>("/:sourceFileId/profile/detailed", async (request) => {
    const { sourceFileId } = request.params;

    const [fileResult, profileResult] = await Promise.all([
      supabase.from("source_files").select("raw_profile, filename, row_count, column_count, status").eq("id", sourceFileId).single(),
      supabase.from("source_profiles").select().eq("source_file_id", sourceFileId).order("column_name"),
    ]);

    if (fileResult.error || !fileResult.data) throw new Error("Source file not found");

    const rawProfile = fileResult.data.raw_profile as { columns?: unknown[]; summary?: unknown } | null;
    const nativeStats = (rawProfile?.columns ?? []) as Array<Record<string, unknown>>;
    const llmProfiles = profileResult.data ?? [];

    const columns = nativeStats.map((stat) => {
      const colName = stat.columnName as string;
      const llm = llmProfiles.find((p) => p.column_name === colName);
      return {
        columnName: colName,
        nativeStats: {
          detectedType: stat.detectedType,
          nullRate: stat.nullRate,
          nullCount: stat.nullCount,
          uniqueCount: stat.uniqueCount,
          uniqueRate: stat.uniqueRate,
          min: stat.min,
          max: stat.max,
          mean: stat.mean,
          median: stat.median,
          stdDev: stat.stdDev,
          topValues: stat.topValues,
          sampleValues: stat.sampleValues,
          patterns: stat.patterns,
        },
        llmInterpretation: llm ? {
          semanticLabel: llm.semantic_label,
          inferredType: llm.inferred_type,
          domain: llm.domain,
          confidence: llm.confidence,
          qualityFlags: llm.quality_flags,
          userCorrected: llm.user_corrected,
        } : null,
      };
    });

    return {
      sourceFileId,
      filename: fileResult.data.filename,
      rowCount: fileResult.data.row_count,
      columnCount: fileResult.data.column_count,
      status: fileResult.data.status,
      summary: rawProfile?.summary ?? null,
      columns,
    };
  });

  // ── Update a profile (user correction) ──
  app.patch<{ Params: { profileId: string }; Body: { semanticLabel?: string; inferredType?: string } }>(
    "/profiles/:profileId",
    async (request) => {
      const { profileId } = request.params;
      const updates = request.body;

      const { data, error } = await supabase
        .from("source_profiles")
        .update({ ...updates, user_corrected: true })
        .eq("id", profileId)
        .select()
        .single();

      if (error) throw new Error(`Failed to update profile: ${error.message}`);
      return data;
    },
  );

  // ── Delete a source file and its storage/profiles ──
  app.delete<{ Params: { sourceFileId: string } }>(
    "/:sourceFileId",
    async (request, reply) => {
      const { sourceFileId } = request.params;

      const { data: file, error: fetchErr } = await supabase
        .from("source_files")
        .select("id, project_id, storage_path, cleaned_path")
        .eq("id", sourceFileId)
        .single();

      if (fetchErr || !file) return reply.status(404).send({ error: "NOT_FOUND", message: "Source file not found" });

      const storagePaths = [file.storage_path, file.cleaned_path].filter(Boolean) as string[];
      if (storagePaths.length > 0) {
        try { await deleteFiles(storagePaths); } catch { /* best-effort */ }
      }

      await supabase.from("source_profiles").delete().eq("source_file_id", sourceFileId);
      await supabase.from("field_mappings").delete().eq("source_file_id", sourceFileId);
      await supabase.from("source_files").delete().eq("id", sourceFileId);

      return reply.status(204).send();
    },
  );
};
