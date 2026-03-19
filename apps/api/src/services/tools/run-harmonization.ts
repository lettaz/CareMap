import { tool } from "ai";
import { z } from "zod";
import { harmonize } from "../harmonizer.js";
import { isYoloMode } from "../../lib/yolo.js";

export const runHarmonizationTool = tool({
  description: "Run harmonization: loads cleaned source files, applies confirmed mappings (renames, casts, transforms), writes canonical files to Supabase Storage, and updates the semantic layer.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    mappingIds: z.array(z.string().uuid()).min(1),
  }),
  needsApproval: async (input) => !(await isYoloMode(input.projectId)),
  execute: async ({ projectId, mappingIds }) => {
    try {
      const result = await harmonize(projectId, mappingIds);
      return {
        success: true,
        ...result,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isRetryable = message.includes("sandbox") || message.includes("ECONN") || message.includes("port");
      return {
        success: false,
        error: message,
        retryable: isRetryable,
        suggestion: isRetryable
          ? "This was a transient sandbox failure. Try calling run_harmonization again."
          : "Check the field_mappings for invalid transformations or missing source columns.",
      };
    }
  },
});
