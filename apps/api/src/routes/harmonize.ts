import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import Papa from "papaparse";
import { harmonize } from "../services/harmonizer.js";
import { downloadFile, manifestPath, harmonizedTablePath } from "../services/storage.js";
import { supabase } from "../config/supabase.js";
import { ValidationError } from "../lib/errors.js";
import { env } from "../config/env.js";

const harmonizeBodySchema = z.object({
  projectId: z.string().uuid(),
  mappingIds: z.array(z.string().uuid()).min(1),
});

export const harmonizeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const parsed = harmonizeBodySchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": env.CORS_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
    });

    try {
      const result = await harmonize(parsed.data.projectId, parsed.data.mappingIds, (line) => {
        reply.raw.write(`data: ${JSON.stringify({ type: "progress", data: { message: line } })}\n\n`);
      });

      reply.raw.write(`data: ${JSON.stringify({ type: "complete", data: result })}\n\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Harmonization failed";
      reply.raw.write(`data: ${JSON.stringify({ type: "error", data: { message } })}\n\n`);
    }

    reply.raw.end();
  });

  app.get<{ Querystring: { projectId: string; nodeId?: string } }>("/tables", async (request) => {
    const { projectId, nodeId } = request.query;
    if (!projectId) throw new ValidationError("projectId is required");

    try {
      const buffer = await downloadFile(manifestPath(projectId, nodeId));
      const manifest = JSON.parse(buffer.toString("utf-8")) as {
        tables: Array<{ name: string; rows: number; columns: string[] }>;
      };

      return { tables: manifest.tables };
    } catch {
      return { tables: [] };
    }
  });

  app.get<{ Params: { tableName: string }; Querystring: { projectId: string; nodeId?: string; limit?: string; offset?: string } }>(
    "/tables/:tableName/preview",
    async (request) => {
      const { projectId, nodeId, limit: limitStr, offset: offsetStr } = request.query;
      const { tableName } = request.params;
      if (!projectId) throw new ValidationError("projectId is required");

      const limit = Math.min(Math.max(parseInt(limitStr ?? "50", 10) || 50, 1), 500);
      const offset = Math.max(parseInt(offsetStr ?? "0", 10) || 0, 0);
      const storagePath = harmonizedTablePath(projectId, tableName, nodeId);

      let buffer: Buffer;
      try {
        buffer = await downloadFile(storagePath);
      } catch {
        throw new ValidationError(`Table "${tableName}" not found`);
      }

      const parsed = Papa.parse<Record<string, unknown>>(buffer.toString("utf-8"), {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      const columns = parsed.meta.fields ?? [];
      const totalRows = parsed.data.length;
      const rows = parsed.data.slice(offset, offset + limit);

      return { tableName, columns, rows, totalRows, previewRows: rows.length, offset };
    },
  );

  app.get<{ Querystring: { projectId: string; nodeId?: string } }>("/relationships", async (request) => {
    const { projectId, nodeId } = request.query;
    if (!projectId) throw new ValidationError("projectId is required");

    let entitiesQuery = supabase
      .from("semantic_entities")
      .select("id, entity_name")
      .eq("project_id", projectId);

    if (nodeId) entitiesQuery = entitiesQuery.eq("node_id", nodeId);

    const { data: entities } = await entitiesQuery;

    if (!entities?.length) return { joins: [] };

    const entityIds = entities.map((e) => e.id);
    const entityNameById = new Map(entities.map((e) => [e.id, e.entity_name]));

    const { data: joins } = await supabase
      .from("semantic_joins")
      .select("from_entity_id, to_entity_id, join_column")
      .or(`from_entity_id.in.(${entityIds.join(",")}),to_entity_id.in.(${entityIds.join(",")})`);

    return {
      joins: (joins ?? []).map((j) => ({
        fromTable: entityNameById.get(j.from_entity_id as string) ?? j.from_entity_id,
        toTable: entityNameById.get(j.to_entity_id as string) ?? j.to_entity_id,
        joinColumn: j.join_column,
      })),
    };
  });
};
