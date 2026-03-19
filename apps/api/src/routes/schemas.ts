import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { supabase } from "../config/supabase.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";

const columnSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

const tableSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  columns: z.array(columnSchema).min(1),
});

const createSchema = z.object({
  tables: z.array(tableSchema).min(1),
  proposedBy: z.enum(["ai", "user"]).default("user"),
});

const updateSchema = z.object({
  tables: z.array(tableSchema).min(1).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export const schemaRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { projectId: string } }>("/:projectId/schema", async (request) => {
    const { projectId } = request.params;

    const { data: active } = await supabase
      .from("target_schemas")
      .select()
      .eq("project_id", projectId)
      .eq("status", "active")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (active) return active;

    const { data: draft } = await supabase
      .from("target_schemas")
      .select()
      .eq("project_id", projectId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draft) return draft;

    return null;
  });

  app.get<{ Params: { projectId: string } }>("/:projectId/schemas", async (request) => {
    const { projectId } = request.params;

    const { data, error } = await supabase
      .from("target_schemas")
      .select()
      .eq("project_id", projectId)
      .order("version", { ascending: false });

    if (error) throw new Error(`Failed to fetch schemas: ${error.message}`);
    return data ?? [];
  });

  app.post<{ Params: { projectId: string }; Body: z.infer<typeof createSchema> }>(
    "/:projectId/schema",
    async (request) => {
      const { projectId } = request.params;
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid schema");

      const { data: latest } = await supabase
        .from("target_schemas")
        .select("version")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (latest?.version as number ?? 0) + 1;

      const { data, error } = await supabase
        .from("target_schemas")
        .insert({
          project_id: projectId,
          version: nextVersion,
          status: "draft",
          tables: parsed.data.tables,
          proposed_by: parsed.data.proposedBy,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create schema: ${error.message}`);
      return data;
    },
  );

  app.patch<{ Params: { projectId: string; schemaId: string }; Body: z.infer<typeof updateSchema> }>(
    "/:projectId/schema/:schemaId",
    async (request) => {
      const { schemaId } = request.params;
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid update");

      const updates: Record<string, unknown> = {};
      if (parsed.data.tables) updates.tables = parsed.data.tables;
      if (parsed.data.status) updates.status = parsed.data.status;

      const { data, error } = await supabase
        .from("target_schemas")
        .update(updates)
        .eq("id", schemaId)
        .select()
        .single();

      if (error) throw new NotFoundError("TargetSchema", schemaId);
      return data;
    },
  );

  app.post<{ Params: { projectId: string; schemaId: string } }>(
    "/:projectId/schema/:schemaId/activate",
    async (request) => {
      const { projectId, schemaId } = request.params;

      await supabase
        .from("target_schemas")
        .update({ status: "archived" })
        .eq("project_id", projectId)
        .eq("status", "active");

      const { data, error } = await supabase
        .from("target_schemas")
        .update({ status: "active" })
        .eq("id", schemaId)
        .select()
        .single();

      if (error) throw new NotFoundError("TargetSchema", schemaId);
      return data;
    },
  );
};
