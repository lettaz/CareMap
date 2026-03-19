import type { FastifyPluginAsync } from "fastify";
import { supabase } from "../config/supabase.js";
import { parseCsv, profileColumns, saveProfiles } from "../services/profiler.js";
import { ValidationError } from "../lib/errors.js";

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Querystring: { projectId: string; nodeId: string } }>("/", async (request, reply) => {
    const { projectId, nodeId } = request.query;
    if (!projectId || !nodeId) throw new ValidationError("projectId and nodeId are required");

    const file = await request.file();
    if (!file) throw new ValidationError("No file uploaded");

    const allowedMimes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const isAllowed = allowedMimes.includes(file.mimetype) || file.filename.endsWith(".csv");
    if (!isAllowed) throw new ValidationError("Unsupported file type. Accepted: CSV, XLSX");

    const buffer = await file.toBuffer();
    const content = buffer.toString("utf-8");

    const parsed = parseCsv(content);

    // Store file reference in Supabase
    const { data: sourceFile, error: sfErr } = await supabase
      .from("source_files")
      .insert({
        project_id: projectId,
        filename: file.filename,
        file_type: file.filename.endsWith(".xlsx") ? "xlsx" : "csv",
        row_count: parsed.rowCount,
        column_count: parsed.columns.length,
        storage_path: null,
        raw_profile: null,
      })
      .select()
      .single();

    if (sfErr || !sourceFile) throw new Error(`Failed to create source file record: ${sfErr?.message}`);

    // Update pipeline node with source file reference
    await supabase
      .from("pipeline_nodes")
      .update({
        config: { sourceFileId: sourceFile.id },
        status: "profiling",
      })
      .eq("id", nodeId);

    // Stream SSE response: parse → profile columns → complete
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // 1. Parse complete event
    reply.raw.write(
      `data: ${JSON.stringify({
        type: "parse_complete",
        data: {
          rowCount: parsed.rowCount,
          columns: parsed.columns,
          sourceFileId: sourceFile.id,
        },
      })}\n\n`,
    );

    try {
      // 2. AI profiling
      const profile = await profileColumns(parsed.columns, parsed.rows);

      for (const col of profile.columns) {
        reply.raw.write(
          `data: ${JSON.stringify({ type: "profile_column", data: col })}\n\n`,
        );
      }

      // 3. Save profiles to DB
      await saveProfiles(sourceFile.id, profile.columns);

      // 4. Update source file with full profile
      await supabase
        .from("source_files")
        .update({ raw_profile: profile as unknown as Record<string, unknown> })
        .eq("id", sourceFile.id);

      // 5. Update node status
      await supabase
        .from("pipeline_nodes")
        .update({ status: "ready", label: profile.summary.suggestedLabel })
        .eq("id", nodeId);

      // 6. Profile complete event
      reply.raw.write(
        `data: ${JSON.stringify({ type: "profile_complete", data: profile.summary })}\n\n`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Profiling failed";
      reply.raw.write(
        `data: ${JSON.stringify({ type: "error", data: { message } })}\n\n`,
      );
    }

    reply.raw.end();
  });

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
};
