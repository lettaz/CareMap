import { tool } from "ai";
import { z } from "zod";
import { generateCleaningPlan } from "../cleaner.js";
import { supabase } from "../../config/supabase.js";

export const suggestCleaningTool = tool({
  description:
    "Get or generate a cleaning plan for a source file. " +
    "Returns the cached plan if one already exists (from upload-time auto-generation), " +
    "or generates a new one if not. Pass regenerate=true to force a fresh plan.",
  inputSchema: z.object({
    sourceFileId: z.string().uuid(),
    regenerate: z.boolean().optional().describe("Force regeneration even if a cached plan exists"),
  }),
  execute: async ({ sourceFileId, regenerate }) => {
    if (!regenerate) {
      const { data } = await supabase
        .from("source_files")
        .select("cleaning_plan")
        .eq("id", sourceFileId)
        .single();

      const cached = data?.cleaning_plan as { plan: unknown[]; script: string; summary: string } | null;
      if (cached?.script) {
        return {
          sourceFileId,
          plan: cached.plan,
          script: cached.script,
          summary: cached.summary,
          actionCount: Array.isArray(cached.plan) ? cached.plan.length : 0,
        };
      }
    }

    return generateCleaningPlan(sourceFileId);
  },
});
