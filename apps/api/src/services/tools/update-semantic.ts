import { tool } from "ai";
import { z } from "zod";
import { updateSemanticLayer } from "../semantic.js";

export const updateSemanticTool = tool({
  description: "Update the semantic layer metadata (entities, fields, joins) after harmonization. Reads manifest.json from Storage and syncs to Supabase Postgres.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
  }),
  execute: async ({ projectId }) => {
    await updateSemanticLayer(projectId);
    return { updated: true, projectId };
  },
});
