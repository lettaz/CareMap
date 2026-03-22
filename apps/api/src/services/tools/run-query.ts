import { tool } from "ai";
import { z } from "zod";
import { executeQuery } from "../query.js";

export const runQueryTool = tool({
  description:
    "Execute a DuckDB SQL query or pandas script against project data files in an E2B sandbox. " +
    "Supports querying at any pipeline stage: individual source files (stage=source), " +
    "cross-source mapped data (stage=mapped), or harmonized files (stage=harmonized). " +
    "Files are auto-loaded as DuckDB tables (for SQL) or pandas DataFrames in a `dataframes` dict (for Python). " +
    "Returns rows, columns, the generated code, and execution time.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    code: z.string().describe("DuckDB SQL query or pandas Python code. For Python, assign your result to `_result`."),
    type: z.enum(["sql", "python"]).default("sql"),
    stage: z.enum(["source", "mapped", "harmonized"]).default("harmonized"),
    sourceFileIds: z.array(z.string().uuid()).optional().describe("For source stage: which specific files to load"),
    nodeId: z
      .string()
      .optional()
      .describe("When stage is 'harmonized', scope to entities from this harmonize node"),
  }),
  execute: async ({ projectId, code, type, stage, sourceFileIds, nodeId }) => {
    try {
      const result = await executeQuery({ projectId, code, type, stage, sourceFileIds, nodeId });

      if (result.error) {
        const isRetryable = result.error.includes("ECONN") || result.error.includes("sandbox") || result.error.includes("port");
        return {
          success: false,
          error: result.error,
          generatedCode: result.generatedCode,
          codeType: type,
          executionTimeMs: result.executionTimeMs,
          retryable: isRetryable,
          suggestion: isRetryable
            ? "Transient sandbox failure. Try calling run_query again."
            : "Check your SQL/Python for syntax errors or incorrect table/column names. Reference the Harmonized Tables section for valid names.",
        };
      }

      return {
        success: true,
        rows: result.rows,
        rowCount: result.rowCount,
        columns: result.columns,
        generatedCode: result.generatedCode,
        codeType: type,
        executionTimeMs: result.executionTimeMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        generatedCode: code,
        codeType: type,
        retryable: true,
        suggestion: "An unexpected error occurred. Try calling run_query again.",
      };
    }
  },
});
