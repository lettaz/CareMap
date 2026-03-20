import { tool } from "ai";
import { z } from "zod";
import { supabase } from "../../config/supabase.js";
import { isYoloMode } from "../../lib/yolo.js";
import { logBulkCorrections } from "../corrections.js";

export const confirmMappingsTool = tool({
  description: "Write user-approved mappings to the field_mappings table. Accepts an array of mapping IDs to confirm or reject.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    approvals: z.array(
      z.object({
        mappingId: z.string().uuid(),
        status: z.enum(["accepted", "rejected"]),
      }),
    ),
  }),
  needsApproval: async (input) => !(await isYoloMode(input.projectId)),
  execute: async ({ projectId, approvals }) => {
    let accepted = 0;
    let rejected = 0;
    const correctionEntries: Array<{ mappingId: string; status: string; sourceColumn: string; targetColumn: string }> = [];

    for (const { mappingId, status } of approvals) {
      const { data: existing } = await supabase
        .from("field_mappings")
        .select("source_column, target_column, status")
        .eq("id", mappingId)
        .single();

      const { error } = await supabase
        .from("field_mappings")
        .update({
          status,
          reviewed_by: "user",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", mappingId);

      if (!error) {
        if (status === "accepted") accepted++;
        else rejected++;

        if (existing) {
          correctionEntries.push({
            mappingId,
            status,
            sourceColumn: existing.source_column,
            targetColumn: existing.target_column,
          });
        }
      }
    }

    await logBulkCorrections(
      correctionEntries.map((e) => ({
        projectId,
        action: "mapping_change" as const,
        description: `Mapping ${e.status}: ${e.sourceColumn} → ${e.targetColumn}`,
        field: e.sourceColumn,
        previousValue: "pending",
        newValue: e.status,
        appliedBy: "user" as const,
      })),
    );

    return { accepted, rejected, total: approvals.length };
  },
});
