import type { FastifyPluginAsync } from "fastify";
import { supabase } from "../config/supabase.js";
import { parseCsv, parseExcel } from "../services/profiler.js";
import { downloadFile, deleteFiles } from "../services/storage.js";
import { ValidationError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { ingestBuffer } from "../services/ingest.js";

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
    const fileType = isExcel ? "xlsx" : isTsv ? "tsv" : "csv";

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": env.CORS_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
    });

    try {
      await ingestBuffer({
        projectId,
        nodeId,
        filename: file.filename,
        buffer,
        fileType,
        onProgress: (type, data) => sseWrite(reply.raw, type, data),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingestion failed";
      sseWrite(reply.raw, "step", { stepType: "error", status: "error", output: { message } });
      sseWrite(reply.raw, "error", { message });
    }

    reply.raw.end();
  });

  // ── Get sample rows for a source file (paginated) ──
  app.get<{ Params: { sourceFileId: string }; Querystring: { page?: string; pageSize?: string; version?: string } }>(
    "/:sourceFileId/sample-rows",
    async (request) => {
      const { sourceFileId } = request.params;
      const page = Math.max(1, Number(request.query.page) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(request.query.pageSize) || 20));
      const version = request.query.version ?? "original";

      const { data: file, error } = await supabase
        .from("source_files")
        .select("project_id, file_type, storage_path, cleaned_path")
        .eq("id", sourceFileId)
        .single();

      if (error || !file) throw new Error("Source file not found");

      const targetPath = version === "cleaned" && file.cleaned_path
        ? file.cleaned_path as string
        : file.storage_path as string | null;

      if (!targetPath) return { data: [], total: 0, page, pageSize };

      const buffer = await downloadFile(targetPath);
      const isExcel = file.file_type === "xlsx" || file.file_type === "xls";
      const isTsv = file.file_type === "tsv";
      const isCsv = version === "cleaned" || !isExcel;

      const parsed = isCsv
        ? parseCsv(buffer.toString("utf-8"), isTsv ? "\t" : undefined)
        : parseExcel(buffer);

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
