import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createAgentStreamResponse } from "../services/agent.js";
import { supabase } from "../config/supabase.js";
import { listHarmonizedTables } from "../services/storage.js";
import { ValidationError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { createSanitizedStream } from "../lib/stream-sanitizer.js";

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

async function resolveProjectAcceptedMappingIds(projectId: string): Promise<string[]> {
  const { data } = await supabase
    .from("field_mappings")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "accepted");

  return (data ?? []).map((m) => m.id as string);
}

async function resolveNodeAcceptedMappingIds(projectId: string, nodeId: string): Promise<string[]> {
  const upstreamSourceFileIds = await resolveUpstreamSourceFileIds(nodeId);
  if (!upstreamSourceFileIds.length) return resolveProjectAcceptedMappingIds(projectId);

  const { data } = await supabase
    .from("field_mappings")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "accepted")
    .in("source_file_id", upstreamSourceFileIds);

  return (data ?? []).map((m) => m.id as string);
}

async function hasActiveSchema(projectId: string, nodeId?: string): Promise<boolean> {
  let query = supabase
    .from("target_schemas")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "active")
    .limit(1);

  if (nodeId) query = query.eq("node_id", nodeId);

  const { data } = await query.maybeSingle();
  return !!data;
}

/**
 * Traverses the DAG backward from any node to collect all upstream source file IDs.
 * Works for Harmonize (through Transform to Sources), Quality (through Harmonize), etc.
 */
async function resolveUpstreamSourceFileIds(nodeId: string): Promise<string[]> {
  const visited = new Set<string>();
  const sourceFileIds: string[] = [];
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const { data: edges } = await supabase
      .from("pipeline_edges")
      .select("source_node_id")
      .eq("target_node_id", current);

    if (!edges?.length) continue;

    const upstreamNodeIds = edges.map((e) => e.source_node_id as string);
    const { data: nodes } = await supabase
      .from("pipeline_nodes")
      .select("id, node_type, config")
      .in("id", upstreamNodeIds);

    for (const n of nodes ?? []) {
      const config = n.config as Record<string, unknown> | null;
      if (n.node_type === "source" && config?.sourceFileId) {
        sourceFileIds.push(config.sourceFileId as string);
      } else {
        queue.push(n.id as string);
      }
    }
  }

  return sourceFileIds;
}

async function resolveUpstreamHarmonizeNodeId(nodeId: string): Promise<string | null> {
  const { data: edges } = await supabase
    .from("pipeline_edges")
    .select("source_node_id")
    .eq("target_node_id", nodeId);

  if (!edges?.length) return null;

  const upstreamNodeIds = edges.map((e) => e.source_node_id as string);
  const { data: nodes } = await supabase
    .from("pipeline_nodes")
    .select("id, node_type")
    .in("id", upstreamNodeIds);

  return (nodes ?? []).find((n) => n.node_type === "harmonize")?.id as string ?? null;
}

async function resolveUpstreamTransformNodeIds(nodeId: string): Promise<string[]> {
  const { data: edges } = await supabase
    .from("pipeline_edges")
    .select("source_node_id")
    .eq("target_node_id", nodeId);

  if (!edges?.length) return [];

  const upstreamNodeIds = edges.map((e) => e.source_node_id as string);
  const { data: nodes } = await supabase
    .from("pipeline_nodes")
    .select("id, node_type")
    .in("id", upstreamNodeIds);

  return (nodes ?? []).filter((n) => n.node_type === "transform").map((n) => n.id as string);
}

async function resolveUnmappedSourceFileIds(projectId: string, sourceFileIds: string[]): Promise<string[]> {
  if (!sourceFileIds.length) return [];

  const { data: mappings } = await supabase
    .from("field_mappings")
    .select("source_file_id")
    .eq("project_id", projectId)
    .in("source_file_id", sourceFileIds);

  const mappedFileIds = new Set((mappings ?? []).map((m) => m.source_file_id as string));
  return sourceFileIds.filter((id) => !mappedFileIds.has(id));
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

        const schemaExists = await hasActiveSchema(projectId, nodeId);

        if (!schemaExists) {
          userMessage =
            `Project ID: ${projectId}. Source nodes have been connected to transform node ${nodeId}. ` +
            `There is NO active target schema for this node yet. Use propose_target_schema (mode="full", nodeId="${nodeId}") to analyze ` +
            `all source profiles and design a target schema. Source file IDs: ${JSON.stringify(sourceFileIds)}. ` +
            `After proposing the schema, inform the user they need to review and activate it in the Transform ` +
            `panel before field mappings can be generated.`;
          break;
        }

        const newSourceFileIds = await resolveUnmappedSourceFileIds(projectId, sourceFileIds);

        if (newSourceFileIds.length > 0) {
          userMessage =
            `Project ID: ${projectId}. New sources connected to transform node ${nodeId}. ` +
            `An active target schema exists for this node. ` +
            `New (unmapped) source file IDs: ${JSON.stringify(newSourceFileIds)}. ` +
            `All connected source file IDs: ${JSON.stringify(sourceFileIds)}.\n\n` +
            `Follow the schema evolution flow:\n` +
            `1. Call propose_target_schema with mode="extend", nodeId="${nodeId}", and the NEW source file IDs.\n` +
            `2. If status="no_changes" — the existing schema covers the new data. Proceed to propose_mappings.\n` +
            `3. If a new schema version is proposed — present the additions and tell the user to activate it.\n` +
            `4. After schema is confirmed, call propose_mappings with nodeId="${nodeId}" for the new source file IDs.`;
        } else {
          userMessage =
            `Project ID: ${projectId}. Source nodes have been connected to transform node ${nodeId}. ` +
            `An active target schema already exists and all sources are already mapped. ` +
            `Please propose field mappings with nodeId="${nodeId}" for all connected sources. ` +
            `Source file IDs: ${JSON.stringify(sourceFileIds)}`;
        }
        break;
      }

      case "harmonize_requested": {
        const mappingIds = await resolveNodeAcceptedMappingIds(projectId, nodeId);
        if (!mappingIds?.length) throw new ValidationError("No accepted mappings found for harmonization");
        const upstreamTransforms = await resolveUpstreamTransformNodeIds(nodeId);
        userMessage =
          `Project ID: ${projectId}. The user wants to harmonize data via harmonize node ${nodeId}. ` +
          `Upstream transform nodes: ${JSON.stringify(upstreamTransforms)}. ` +
          `Follow the harmonization flow: first call generate_harmonization_script with nodeId="${nodeId}" to produce an intelligent ` +
          `pandas script, then present the script and explain the merge strategy, then call ` +
          `execute_harmonization_script with nodeId="${nodeId}" to run it. Mapping IDs: ${JSON.stringify(mappingIds)}`;
        break;
      }

      case "export_requested": {
        const nodeConfig = await resolveNodeConfig(nodeId);
        const format = (nodeConfig?.format as string) ?? "csv";
        const upstreamHarmonizeId = await resolveUpstreamHarmonizeNodeId(nodeId);
        const tables = await listHarmonizedTables(projectId, upstreamHarmonizeId ?? undefined);
        if (!tables.length) throw new ValidationError("No harmonized tables found for export");

        userMessage =
          `Project ID: ${projectId}. The user wants to export harmonized data from output node ${nodeId}. ` +
          (upstreamHarmonizeId ? `Upstream harmonize node: ${upstreamHarmonizeId}. ` : "") +
          `Available harmonized tables: ${JSON.stringify(tables)}. ` +
          `Desired format: ${format}. ` +
          `Read the harmonized data using run_query or run_script` +
          (upstreamHarmonizeId ? ` with nodeId="${upstreamHarmonizeId}"` : "") +
          `, then use export_data with format="${format}" to create a downloadable file.`;
        break;
      }

      case "quality_check_requested": {
        const upstreamHarmonizeId = await resolveUpstreamHarmonizeNodeId(nodeId);
        const tables = await listHarmonizedTables(projectId, upstreamHarmonizeId ?? undefined);
        const sourceFileIds = await resolveUpstreamSourceFileIds(nodeId);

        if (tables.length > 0) {
          userMessage =
            `Project ID: ${projectId}. The user triggered a quality check from quality node ${nodeId}. ` +
            (upstreamHarmonizeId ? `Upstream harmonize node: ${upstreamHarmonizeId}. ` : "") +
            `Harmonized tables: ${JSON.stringify(tables)}. ` +
            `Write a comprehensive Python quality-check script and run it via run_quality_check ` +
            `with nodeId="${nodeId}"` +
            (upstreamHarmonizeId ? ` and harmonizeNodeId="${upstreamHarmonizeId}"` : "") +
            `. Check for: null rates, duplicates, outliers, type inconsistencies, referential integrity, ` +
            `and any domain-specific issues you can detect from the data.`;
        } else if (sourceFileIds.length > 0) {
          userMessage =
            `Project ID: ${projectId}. The user triggered a quality check from quality node ${nodeId}. ` +
            `No harmonized tables exist upstream, but source files are connected. ` +
            `Please check the source profiles for quality issues. Source file IDs: ${JSON.stringify(sourceFileIds)}`;
        } else {
          userMessage =
            `Project ID: ${projectId}. The user triggered a quality check from quality node ${nodeId}. ` +
            `Write a quality-check script and run it via run_quality_check with nodeId="${nodeId}" ` +
            `to scan all available data.`;
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
      const sanitized = createSanitizedStream(response.body);
      const reader = sanitized.getReader();
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
