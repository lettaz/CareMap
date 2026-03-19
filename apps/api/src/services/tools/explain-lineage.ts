import { tool } from "ai";
import { z } from "zod";
import { supabase } from "../../config/supabase.js";

export const explainLineageTool = tool({
  description: "Trace a target column back through field_mappings to source_profiles and source_files. Pure metadata query — no sandbox needed.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    targetTable: z.string(),
    targetColumn: z.string(),
  }),
  execute: async ({ projectId, targetTable, targetColumn }) => {
    const { data: mappings } = await supabase
      .from("field_mappings")
      .select()
      .eq("project_id", projectId)
      .eq("target_table", targetTable)
      .eq("target_column", targetColumn);

    if (!mappings?.length) {
      return { found: false, message: `No mapping found for ${targetTable}.${targetColumn}` };
    }

    const lineage = [];
    for (const m of mappings) {
      const { data: sf } = await supabase
        .from("source_files")
        .select("filename, file_type")
        .eq("id", m.source_file_id)
        .single();

      const { data: profile } = await supabase
        .from("source_profiles")
        .select("inferred_type, semantic_label, domain, confidence, quality_flags")
        .eq("source_file_id", m.source_file_id)
        .eq("column_name", m.source_column)
        .single();

      lineage.push({
        sourceFile: sf?.filename ?? m.source_file_id,
        sourceColumn: m.source_column,
        targetTable: m.target_table,
        targetColumn: m.target_column,
        confidence: m.confidence,
        reasoning: m.reasoning,
        transformation: m.transformation,
        profile: profile ?? null,
      });
    }

    return { found: true, lineage };
  },
});
