import { tool } from "ai";
import { z } from "zod";
import { executeCleaning, type CleaningAction } from "../cleaner.js";
import { isYoloMode } from "../../lib/yolo.js";

const cleaningActionSchema = z.object({
  column: z.string(),
  action: z.enum(["parseDate", "fillNulls", "normalizeString", "castType", "deduplicateRows", "convertUnit"]),
  params: z.record(z.unknown()).default({}),
  reason: z.string(),
});

export const executeCleaningTool = tool({
  description: "Apply the approved cleaning plan to a source file. Runs pandas transforms in an E2B sandbox and writes a cleaned file to Supabase Storage.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    sourceFileId: z.string().uuid(),
    actions: z.array(cleaningActionSchema),
  }),
  needsApproval: async (input) => !(await isYoloMode(input.projectId)),
  execute: async ({ projectId, sourceFileId, actions }) => {
    try {
      const result = await executeCleaning(projectId, sourceFileId, actions as CleaningAction[]);
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
        sourceFileId,
        retryable: isRetryable,
        suggestion: isRetryable
          ? "This was a transient sandbox failure. Try calling execute_cleaning again with the same parameters."
          : "Check the cleaning actions for invalid column names or incompatible transformations.",
      };
    }
  },
});
