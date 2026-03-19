import type { FastifyPluginAsync } from "fastify";
import { supabase } from "../config/supabase.js";
import { generateMappings, getMappingsByProject, updateMappingStatus } from "../services/mapper.js";
import { generateMappingsSchema, updateMappingSchema } from "../lib/types/api.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";

export const mappingRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { projectId: string } }>("/", async (request) => {
    const { projectId } = request.query;
    if (!projectId) throw new ValidationError("projectId is required");
    return getMappingsByProject(projectId);
  });

  app.post<{ Querystring: { projectId: string } }>("/generate", async (request) => {
    const { projectId } = request.query;
    if (!projectId) throw new ValidationError("projectId is required");

    const parsed = generateMappingsSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

    const allMappings = [];

    for (const sourceNodeId of parsed.data.sourceNodeIds) {
      const { data: node } = await supabase
        .from("pipeline_nodes")
        .select("config")
        .eq("id", sourceNodeId)
        .single();

      const sourceFileId = (node?.config as Record<string, string> | null)?.sourceFileId;
      if (!sourceFileId) throw new NotFoundError("Source file for node", sourceNodeId);

      const { data: profiles } = await supabase
        .from("source_profiles")
        .select()
        .eq("source_file_id", sourceFileId);

      if (!profiles?.length) throw new NotFoundError("Profiles for source", sourceFileId);

      const columnProfiles = profiles.map((p) => ({
        columnName: p.column_name,
        inferredType: p.inferred_type,
        semanticLabel: p.semantic_label,
        domain: p.domain,
        confidence: p.confidence,
        sampleValues: p.sample_values as unknown[],
      }));

      const mappings = await generateMappings(projectId, sourceFileId, columnProfiles);
      allMappings.push(...mappings);
    }

    return allMappings;
  });

  app.patch<{ Params: { id: string } }>("/:id", async (request) => {
    const { id } = request.params;
    const parsed = updateMappingSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

    const updates: Record<string, unknown> = {};
    if (parsed.data.status) updates.status = parsed.data.status;
    if (parsed.data.targetTable) updates.target_table = parsed.data.targetTable;
    if (parsed.data.targetColumn) updates.target_column = parsed.data.targetColumn;
    if (parsed.data.transformation !== undefined) updates.transformation = parsed.data.transformation;

    return updateMappingStatus(id, updates);
  });

  app.post<{ Querystring: { projectId: string } }>("/bulk-accept", async (request) => {
    const { projectId } = request.query;
    if (!projectId) throw new ValidationError("projectId is required");

    const body = request.body as { threshold?: number };
    const threshold = body.threshold ?? 0.85;

    const { data, error } = await supabase
      .from("field_mappings")
      .update({
        status: "accepted",
        reviewed_by: "auto",
        reviewed_at: new Date().toISOString(),
      })
      .eq("project_id", projectId)
      .eq("status", "pending")
      .gte("confidence", threshold)
      .select();

    if (error) throw new Error(`Bulk accept failed: ${error.message}`);
    return { accepted: data?.length ?? 0 };
  });
};
