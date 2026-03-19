import { tool } from "ai";
import { z } from "zod";
import { harmonize } from "../harmonizer.js";
import { isYoloMode } from "../../lib/yolo.js";

export const runHarmonizationTool = tool({
  description: "Run harmonization: loads cleaned Parquets, applies confirmed mappings (renames, casts, transforms), writes canonical Parquet files to Supabase Storage, and updates the semantic layer.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    mappingIds: z.array(z.string().uuid()).min(1),
  }),
  needsApproval: async (input) => !(await isYoloMode(input.projectId)),
  execute: async ({ projectId, mappingIds }) => {
    return harmonize(projectId, mappingIds);
  },
});
