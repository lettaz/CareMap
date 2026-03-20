import { tool } from "ai";
import { z } from "zod";
import { generateMappings } from "../mapper.js";
import { supabase } from "../../config/supabase.js";
import { logBulkCorrections } from "../corrections.js";

export const proposeMappingsTool = tool({
  description: "Given cleaned source profiles and the canonical clinical schema, propose source-to-target column mappings with confidence scores, reasoning, and transformation rules.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    sourceFileIds: z.array(z.string().uuid()),
  }),
  execute: async ({ projectId, sourceFileIds }) => {
    try {
      const allMappings = [];

      for (const sourceFileId of sourceFileIds) {
        const { data: profiles } = await supabase
          .from("source_profiles")
          .select()
          .eq("source_file_id", sourceFileId);

        if (!profiles?.length) continue;

        const columnProfiles = profiles.map((p) => ({
          columnName: p.column_name,
          inferredType: p.inferred_type,
          semanticLabel: p.semantic_label,
          domain: p.domain,
          confidence: p.confidence,
          sampleValues: p.sample_values ?? [],
        }));

        const mappings = await generateMappings(projectId, sourceFileId, columnProfiles);
        allMappings.push(...mappings);
      }

      if (allMappings.length === 0) {
        return {
          success: false,
          error: "No mappings generated. Source files may have no profiles or no active target schema.",
          suggestion: "Ensure source files are profiled and an active target schema exists for the project.",
        };
      }

      const autoAccepted = allMappings.filter((m) => m.status === "accepted");
      if (autoAccepted.length > 0) {
        await logBulkCorrections(
          autoAccepted.map((m) => ({
            projectId,
            action: "mapping_change" as const,
            description: `Auto-accepted mapping: ${m.source_column} → ${m.target_table}.${m.target_column} (${Math.round(m.confidence * 100)}% confidence)`,
            field: m.source_column,
            newValue: `${m.target_table}.${m.target_column}`,
          })),
        );
      }

      return {
        success: true,
        mappings: allMappings.map((m) => ({
          id: m.id,
          sourceColumn: m.source_column,
          targetTable: m.target_table,
          targetColumn: m.target_column,
          confidence: m.confidence,
          reasoning: m.reasoning,
          status: m.status,
        })),
        totalMappings: allMappings.length,
        autoAccepted: autoAccepted.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        retryable: message.includes("Empty response") || message.includes("JSON"),
        suggestion: message.includes("No active schema")
          ? "No active target schema found. Propose and activate a target schema first."
          : "An error occurred during mapping. Try calling propose_mappings again.",
      };
    }
  },
});
