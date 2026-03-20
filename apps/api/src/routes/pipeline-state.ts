import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { supabase } from "../config/supabase.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

const pipelineNodeSchema = z.object({
  id: z.string(),
  node_type: z.string(),
  label: z.string(),
  config: z.record(z.unknown()).nullable().default(null),
  position: z.object({ x: z.number(), y: z.number() }),
  status: z.string().default("idle"),
});

const pipelineEdgeSchema = z.object({
  id: z.string(),
  source_node_id: z.string(),
  target_node_id: z.string(),
});

const savePipelineSchema = z.object({
  nodes: z.array(pipelineNodeSchema),
  edges: z.array(pipelineEdgeSchema),
});

async function enrichSourceNodes(nodes: Record<string, unknown>[]) {
  const sourceNodes = nodes.filter(
    (n) => n.node_type === "source" && (n.config as Record<string, unknown>)?.sourceFileId,
  );

  if (!sourceNodes.length) return nodes;

  const fileIds = sourceNodes.map(
    (n) => (n.config as Record<string, unknown>).sourceFileId as string,
  );

  const { data: files } = await supabase
    .from("source_files")
    .select("id, row_count, column_count, file_type, raw_profile, status")
    .in("id", fileIds);

  if (!files?.length) return nodes;

  const fileMap = new Map(files.map((f) => [f.id, f]));

  return nodes.map((node) => {
    const cfg = node.config as Record<string, unknown> | null;
    const fileId = cfg?.sourceFileId as string | undefined;
    if (!fileId || node.node_type !== "source") return node;

    const file = fileMap.get(fileId);
    if (!file) return node;

    const rawProfile = file.raw_profile as { summary?: { domain?: string; description?: string } } | null;

    return {
      ...node,
      config: {
        ...cfg,
        rowCount: file.row_count,
        columnCount: file.column_count,
        fileType: file.file_type,
        domain: rawProfile?.summary?.domain,
        description: rawProfile?.summary?.description,
      },
    };
  });
}

export const pipelineStateRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { projectId: string } }>("/:projectId/pipeline", async (request) => {
    const { projectId } = request.params;

    const [nodesResult, edgesResult] = await Promise.all([
      supabase.from("pipeline_nodes").select().eq("project_id", projectId),
      supabase.from("pipeline_edges").select().eq("project_id", projectId),
    ]);

    if (nodesResult.error) throw new Error(`Failed to fetch nodes: ${nodesResult.error.message}`);
    if (edgesResult.error) throw new Error(`Failed to fetch edges: ${edgesResult.error.message}`);

    const nodes = nodesResult.data ?? [];
    const enriched = await enrichSourceNodes(nodes);

    return {
      nodes: enriched,
      edges: edgesResult.data ?? [],
    };
  });

  app.put<{ Params: { projectId: string } }>("/:projectId/pipeline", async (request) => {
    const { projectId } = request.params;
    const parsed = savePipelineSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid pipeline data");

    const { nodes, edges } = parsed.data;

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();

    if (!project) throw new NotFoundError("Project", projectId);

    await supabase.from("pipeline_edges").delete().eq("project_id", projectId);
    await supabase.from("pipeline_nodes").delete().eq("project_id", projectId);

    if (nodes.length > 0) {
      const nodeRows = nodes.map((n) => ({ ...n, project_id: projectId }));
      const { error: nodesErr } = await supabase.from("pipeline_nodes").insert(nodeRows);
      if (nodesErr) throw new Error(`Failed to save nodes: ${nodesErr.message}`);
    }

    if (edges.length > 0) {
      const edgeRows = edges.map((e) => ({ ...e, project_id: projectId }));
      const { error: edgesErr } = await supabase.from("pipeline_edges").insert(edgeRows);
      if (edgesErr) throw new Error(`Failed to save edges: ${edgesErr.message}`);
    }

    return { saved: true, nodeCount: nodes.length, edgeCount: edges.length };
  });
};
