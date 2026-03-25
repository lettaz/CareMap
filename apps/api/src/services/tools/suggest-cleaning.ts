import { tool } from "ai";
import { z } from "zod";
import { generateCleaningPlan } from "../cleaner.js";

export const suggestCleaningTool = tool({
  description:
    "Analyze source column profiles and propose a cleaning plan with a ready-to-execute Python script. " +
    "Returns a human-readable plan and a pandas script for execute_cleaning.",
  inputSchema: z.object({
    sourceFileId: z.string().uuid(),
  }),
  execute: async ({ sourceFileId }) => generateCleaningPlan(sourceFileId),
});
