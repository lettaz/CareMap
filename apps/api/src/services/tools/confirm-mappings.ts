import { tool } from "ai";
import { z } from "zod";
import { supabase } from "../../config/supabase.js";
import { isYoloMode } from "../../lib/yolo.js";

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
  execute: async ({ approvals }) => {
    let accepted = 0;
    let rejected = 0;

    for (const { mappingId, status } of approvals) {
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
      }
    }

    return { accepted, rejected, total: approvals.length };
  },
});
