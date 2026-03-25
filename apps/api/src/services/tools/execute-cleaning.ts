import { tool } from "ai";
import { z } from "zod";
import { executeCleaning, type StepResult } from "../cleaner.js";
import { logCorrection } from "../corrections.js";

const CATASTROPHIC_DROP_THRESHOLD = 0.50;

function findDestructiveSteps(steps: StepResult[]): StepResult[] {
  return steps.filter((s) => {
    if (s.rowsBefore === 0) return false;
    const dropRate = (s.rowsBefore - s.rowsAfter) / s.rowsBefore;
    return dropRate > CATASTROPHIC_DROP_THRESHOLD;
  });
}

export const executeCleaningTool = tool({
  description:
    "Execute a Python cleaning script on a source file in an E2B sandbox. " +
    "The script receives a pre-loaded pandas DataFrame as `df` and numpy as `np`. " +
    "It should transform `df` in place. A helper function `log_step(step_num, column, action, rows_before, rows_after, warn='')` " +
    "is available to log per-step progress. The framework handles file I/O and storage. " +
    "IMPORTANT: If the result has catastrophicDataLoss=true, you MUST analyze the issue, " +
    "rewrite the script to avoid the row loss, and re-run — do NOT just report it.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    sourceFileId: z.string().uuid(),
    script: z.string().describe(
      "Python pandas/numpy code that transforms `df` in place. " +
      "Use log_step() to report each transformation step. " +
      "NEVER drop rows to handle nulls — use fillna, interpolation, or flagging instead.",
    ),
    description: z.string().describe("Human-readable summary of what this cleaning script does"),
  }),
  needsApproval: false,
  execute: async ({ projectId, sourceFileId, script, description }) => {
    try {
      const result = await executeCleaning(projectId, sourceFileId, script);

      await logCorrection({
        projectId,
        action: "value_fix",
        description,
        sourceFileId,
        field: "*",
        appliedBy: "ai",
      });

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
            `Rewrite your script to avoid row loss. Use fillna(), interpolation, or sentinel values instead of dropna(). ` +
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
          ? "Transient sandbox failure. Try calling execute_cleaning again."
          : "Check the script for syntax errors or incorrect column names.",
      };
    }
  },
});
