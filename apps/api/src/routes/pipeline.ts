import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createAgentStreamResponse } from "../services/agent.js";
import { supabase } from "../config/supabase.js";
import { listHarmonizedTables } from "../services/storage.js";
import { ValidationError } from "../lib/errors.js";
import { env } from "../config/env.js";

const triggerSchema = z.object({
  nodeId: z.string(),
  action: z.enum([
    "upload_complete",
    "suggest_cleaning_requested",
    "clean_requested",
    "sources_connected",
    "harmonize_requested",
    "export_requested",
    "quality_check_requested",
  ]),
  context: z.record(z.unknown()).optional(),
});

async function resolveSourceFileId(nodeId: string): Promise<string | null> {
  const { data } = await supabase
    .from("pipeline_nodes")
    .select("config")
    .eq("id", nodeId)
    .single();

  return (data?.config as Record<string, unknown>)?.sourceFileId as string ?? null;
}

async function resolveConnectedSourceFileIds(mappingNodeId: string): Promise<string[]> {
  const { data: edges } = await supabase
    .from("pipeline_edges")
    .select("source_node_id")
    .eq("target_node_id", mappingNodeId);

  if (!edges?.length) return [];

  const sourceNodeIds = edges.map((e) => e.source_node_id as string);

  const { data: nodes } = await supabase
    .from("pipeline_nodes")
    .select("id, config")
    .in("id", sourceNodeIds);

  if (!nodes?.length) return [];

  return nodes
    .map((n) => (n.config as Record<string, unknown>)?.sourceFileId as string)
    .filter(Boolean);
}

async function resolveAcceptedMappingIds(sourceFileIds: string[]): Promise<string[]> {
  if (!sourceFileIds.length) return [];

  const { data } = await supabase
    .from("field_mappings")
    .select("id")
    .in("source_file_id", sourceFileIds)
    .eq("status", "accepted");

  return (data ?? []).map((m) => m.id as string);
}

async function hasActiveSchema(projectId: string): Promise<boolean> {
  const { data } = await supabase
    .from("target_schemas")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return !!data;
}

async function resolveSourceFilename(sourceFileId: string): Promise<string> {
  const { data } = await supabase
    .from("source_files")
    .select("filename")
    .eq("id", sourceFileId)
    .single();

  return (data?.filename as string) ?? "unknown";
}

async function resolveNodeConfig(nodeId: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("pipeline_nodes")
    .select("config")
    .eq("id", nodeId)
    .single();

  return (data?.config as Record<string, unknown>) ?? null;
}

export const pipelineRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { projectId: string } }>("/:projectId/pipeline/trigger", async (request, reply) => {
    const { projectId } = request.params;
    const parsed = triggerSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid pipeline trigger");

    const { action, nodeId, context } = parsed.data;
    let userMessage = "";

    switch (action) {
      case "upload_complete": {
        const sourceFileId = (context?.sourceFileId as string) || await resolveSourceFileId(nodeId);
        userMessage = `Project ID: ${projectId}. A new file has been uploaded to source node ${nodeId}. Please parse, profile, and suggest a cleaning plan for it.${sourceFileId ? ` Source file ID: ${sourceFileId}` : ""}`;
        break;
      }

      case "suggest_cleaning_requested": {
        const sourceFileId = (context?.sourceFileId as string) || await resolveSourceFileId(nodeId);
        if (!sourceFileId) throw new ValidationError("Could not resolve source file for this node");
        const filename = await resolveSourceFilename(sourceFileId);
        userMessage = `Project ID: ${projectId}. Please analyze the column profiles for source node ${nodeId} (file: ${filename}) and suggest a cleaning plan. Source file ID: ${sourceFileId}`;
        break;
      }

      case "clean_requested": {
        const sourceFileId = (context?.sourceFileId as string) || await resolveSourceFileId(nodeId);
        if (!sourceFileId) throw new ValidationError("Could not resolve source file for this node");
        const actionsJson = context?.actions ? JSON.stringify(context.actions) : null;
        if (!actionsJson) throw new ValidationError("Cleaning actions are required for clean_requested");
        userMessage = `Project ID: ${projectId}. The user has approved a cleaning plan for source node ${nodeId}. Please execute the cleaning. Source file ID: ${sourceFileId}. Actions: ${actionsJson}`;
        break;
      }

      case "sources_connected": {
        const sourceFileIds =
          (context?.sourceFileIds as string[]) || await resolveConnectedSourceFileIds(nodeId);
        if (!sourceFileIds.length) throw new ValidationError("No connected source files found for this mapping node");

        const schemaExists = await hasActiveSchema(projectId);

        if (schemaExists) {
          userMessage = `Project ID: ${projectId}. Source nodes have been connected to mapping node ${nodeId}. An active target schema already exists. Please propose field mappings for all connected sources. Source file IDs: ${JSON.stringify(sourceFileIds)}`;
        } else {
          userMessage = `Project ID: ${projectId}. Source nodes have been connected to mapping node ${nodeId}. There is NO active target schema yet. First, use the propose_target_schema tool to analyze all source profiles and design a target schema. Source file IDs: ${JSON.stringify(sourceFileIds)}. After proposing the schema, DO NOT proceed to mapping — the user needs to review and activate the schema first.`;
        }
        break;
      }

      case "harmonize_requested": {
        let mappingIds = context?.mappingIds as string[] | undefined;
        if (!mappingIds?.length) {
          const sourceFileIds = await resolveConnectedSourceFileIds(nodeId);
          mappingIds = await resolveAcceptedMappingIds(sourceFileIds);
        }
        if (!mappingIds?.length) throw new ValidationError("No accepted mappings found for harmonization");
        userMessage = `Project ID: ${projectId}. The user wants to harmonize data via node ${nodeId}. Please run harmonization using confirmed mappings. Mapping IDs: ${JSON.stringify(mappingIds)}`;
        break;
      }

      case "export_requested": {
        const nodeConfig = await resolveNodeConfig(nodeId);
        const format = (nodeConfig?.format as string) ?? "csv";
        const tables = await listHarmonizedTables(projectId);
        if (!tables.length) throw new ValidationError("No harmonized tables found for export");

        userMessage =
          `Project ID: ${projectId}. The user wants to export harmonized data from output node ${nodeId}. ` +
          `Available harmonized tables: ${JSON.stringify(tables)}. ` +
          `Desired format: ${format}. ` +
          `Read the harmonized data using run_query or run_script, then use export_data with format="${format}" to create a downloadable file.`;
        break;
      }

      case "quality_check_requested": {
        const tables = await listHarmonizedTables(projectId);
        const sourceFileIds = await resolveConnectedSourceFileIds(nodeId);

        if (tables.length > 0) {
          userMessage =
            `Project ID: ${projectId}. The user triggered a quality check from node ${nodeId}. ` +
            `Please run run_quality_check to scan all harmonized tables for null rates, duplicates, and range violations. ` +
            `Harmonized tables: ${JSON.stringify(tables)}.`;
        } else if (sourceFileIds.length > 0) {
          userMessage =
            `Project ID: ${projectId}. The user triggered a quality check from node ${nodeId}. ` +
            `No harmonized tables exist yet, but source files are connected. ` +
            `Please check the source profiles for quality issues. Source file IDs: ${JSON.stringify(sourceFileIds)}`;
        } else {
          userMessage =
            `Project ID: ${projectId}. The user triggered a quality check from node ${nodeId}. ` +
            `Please run run_quality_check to scan all available data for quality issues.`;
        }
        break;
      }
    }

    const response = await createAgentStreamResponse({
      projectId,
      messages: [{ role: "user", content: userMessage }],
    });

    const status = response.status;
    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": env.CORS_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
    };
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    reply.raw.writeHead(status, headers);

    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(value);
        }
      } catch {
        // Client disconnected
      }
    }

    reply.raw.end();
  });
};
