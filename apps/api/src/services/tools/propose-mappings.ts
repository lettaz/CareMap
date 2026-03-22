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
    nodeId: z
      .string()
      .optional()
      .describe("The transform node ID that owns these mappings"),
  }),
  execute: async ({ projectId, sourceFileIds, nodeId }) => {
    try {
      const allMappings: Array<{ row: Awaited<ReturnType<typeof generateMappings>>[number]; sourceFilename: string }> = [];

      for (const sourceFileId of sourceFileIds) {
        const [{ data: file }, { data: profiles }] = await Promise.all([
          supabase.from("source_files").select("filename").eq("id", sourceFileId).single(),
          supabase.from("source_profiles").select().eq("source_file_id", sourceFileId),
        ]);

        if (!profiles?.length) continue;

        const columnProfiles = profiles.map((p) => ({
          columnName: p.column_name,
          inferredType: p.inferred_type,
          semanticLabel: p.semantic_label,
          domain: p.domain,
          confidence: p.confidence,
          sampleValues: p.sample_values ?? [],
        }));

        const mappings = await generateMappings(
          projectId,
          sourceFileId,
          columnProfiles,
          nodeId,
        );
        const filename = file?.filename?.replace(/\.[^.]+$/, "") ?? sourceFileId;
        allMappings.push(...mappings.map((row) => ({ row, sourceFilename: filename })));
      }

      if (allMappings.length === 0) {
        return {
          success: false,
          error: "No mappings generated. Source files may have no profiles or no active target schema.",
          suggestion: "Ensure source files are profiled and an active target schema exists for the project.",
        };
      }

      const autoAccepted = allMappings.filter((m) => m.row.status === "accepted");
      if (autoAccepted.length > 0) {
        await logBulkCorrections(
          autoAccepted.map((m) => ({
            projectId,
            action: "mapping_change" as const,
            description: `Auto-accepted mapping: ${m.row.source_column} → ${m.row.target_table}.${m.row.target_column} (${Math.round(m.row.confidence * 100)}% confidence)`,
            field: m.row.source_column,
            newValue: `${m.row.target_table}.${m.row.target_column}`,
          })),
        );
      }

      const uniqueTargetColumns = new Set(
        allMappings.map((m) => `${m.row.target_table}.${m.row.target_column}`),
      ).size;

      return {
        success: true,
        mappings: allMappings.map((m) => ({
          id: m.row.id,
          sourceFileId: m.row.source_file_id,
          sourceFilename: m.sourceFilename,
          sourceColumn: m.row.source_column,
          targetTable: m.row.target_table,
          targetColumn: m.row.target_column,
          confidence: m.row.confidence,
          reasoning: m.row.reasoning,
          status: m.row.status,
          nodeId: nodeId ?? undefined,
        })),
        totalMappings: allMappings.length,
        uniqueTargetColumns,
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
