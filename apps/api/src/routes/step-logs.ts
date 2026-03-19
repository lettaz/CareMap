import type { FastifyPluginAsync } from "fastify";
import { supabase } from "../config/supabase.js";

export const stepLogRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { projectId: string; nodeId: string } }>(
    "/:projectId/nodes/:nodeId/steps",
    async (request) => {
      const { projectId, nodeId } = request.params;

      const { data, error } = await supabase
        .from("pipeline_step_logs")
        .select()
        .eq("project_id", projectId)
        .eq("node_id", nodeId)
        .order("created_at", { ascending: true });

      if (error) throw new Error(`Failed to fetch step logs: ${error.message}`);
      return data ?? [];
    },
  );

  app.get<{ Params: { sourceFileId: string } }>(
    "/source-files/:sourceFileId/steps",
    async (request) => {
      const { sourceFileId } = request.params;

      const { data, error } = await supabase
        .from("pipeline_step_logs")
        .select()
        .eq("source_file_id", sourceFileId)
        .order("created_at", { ascending: true });

      if (error) throw new Error(`Failed to fetch step logs: ${error.message}`);
      return data ?? [];
    },
  );
};
