import { tool } from "ai";
import { z } from "zod";
import { executeCleaning, type CleaningAction, type StepResult } from "../cleaner.js";
import { logBulkCorrections } from "../corrections.js";

const CATASTROPHIC_DROP_THRESHOLD = 0.50;

const cleaningActionSchema = z.object({
  column: z.string(),
  action: z.enum(["parseDate", "fillNulls", "normalizeString", "castType", "deduplicateRows", "convertUnit"]),
  params: z.record(z.unknown()).default({}),
  reason: z.string(),
});

function findDestructiveSteps(steps: StepResult[]): StepResult[] {
  return steps.filter((s) => {
    if (s.rowsBefore === 0) return false;
    const dropRate = (s.rowsBefore - s.rowsAfter) / s.rowsBefore;
    return dropRate > CATASTROPHIC_DROP_THRESHOLD;
  });
}

export const executeCleaningTool = tool({
  description:
    "Apply the approved cleaning plan to a source file. Runs pandas transforms in an E2B sandbox " +
    "and writes a cleaned file to Supabase Storage. The cleaned file is stored alongside the original; " +
    "the original source is preserved. Returns per-step results so the user can see each action's impact. " +
    "IMPORTANT: If the result has catastrophicDataLoss=true, you MUST automatically fix the problematic " +
    "step(s) listed in destructiveSteps and re-run with corrected actions — do NOT just report it.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    sourceFileId: z.string().uuid(),
    actions: z.array(cleaningActionSchema),
  }),
  needsApproval: false,
  execute: async ({ projectId, sourceFileId, actions }) => {
    try {
      const result = await executeCleaning(projectId, sourceFileId, actions as CleaningAction[]);

      await logBulkCorrections(
        actions.map((a) => ({
          projectId,
          action: "value_fix" as const,
          description: `${a.action} on column "${a.column}": ${a.reason}`,
          sourceFileId,
          field: a.column,
          appliedBy: "ai" as const,
        })),
      );

      const dropRate = result.rowsBefore > 0
        ? (result.rowsBefore - result.rowsAfter) / result.rowsBefore
        : 0;
      const isCatastrophic = dropRate > CATASTROPHIC_DROP_THRESHOLD;
      const destructiveSteps = findDestructiveSteps(result.steps);

      return {
        success: true,
        sourceFileId,
        rowsBefore: result.rowsBefore,
        rowsAfter: result.rowsAfter,
        columnsCleaned: result.columnsCleaned,
        steps: result.steps,
        cleanedStoragePath: result.cleanedStoragePath,
        summary: result.summary,
        script: result.script,
        catastrophicDataLoss: isCatastrophic,
        ...(isCatastrophic && {
          dropPercentage: Math.round(dropRate * 100),
          destructiveSteps: destructiveSteps.map((s) => ({
            step: s.step,
            column: s.column,
            action: s.action,
            rowsBefore: s.rowsBefore,
            rowsAfter: s.rowsAfter,
          })),
          autoRetryRecommended: true,
          retryGuidance:
            `Cleaning dropped ${Math.round(dropRate * 100)}% of rows (${result.rowsBefore} → ${result.rowsAfter}). ` +
            `The destructive step(s): ${destructiveSteps.map((s) => `step ${s.step} (${s.action} on "${s.column}" dropped ${s.rowsBefore} → ${s.rowsAfter})`).join("; ")}. ` +
            `You MUST re-run execute_cleaning with corrected actions: either remove the problematic step, change its strategy ` +
            `(e.g., fillNulls with strategy="median" instead of strategy="drop"), or use a softer approach. ` +
            `Do NOT ask the user — fix this automatically.`,
        }),
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
