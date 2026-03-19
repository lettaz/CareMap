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
  description: "Apply the approved cleaning plan to a source file. Runs pandas transforms in an E2B sandbox and writes a cleaned Parquet file to Supabase Storage.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    sourceFileId: z.string().uuid(),
    actions: z.array(cleaningActionSchema),
  }),
  needsApproval: async (input) => !(await isYoloMode(input.projectId)),
  execute: async ({ projectId, sourceFileId, actions }) => {
    return executeCleaning(projectId, sourceFileId, actions as CleaningAction[]);
  },
});
