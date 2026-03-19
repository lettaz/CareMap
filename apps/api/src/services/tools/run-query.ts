import { tool } from "ai";
import { z } from "zod";
import { executeQuery } from "../query.js";

export const runQueryTool = tool({
  description: "Execute a DuckDB SQL query or pandas script against project data files in an E2B sandbox. Supports querying at any pipeline stage: individual source files (stage=source), cross-source mapped data (stage=mapped), or harmonized Parquet files (stage=harmonized). Files are auto-loaded as DuckDB tables (for SQL) or pandas DataFrames in a `dataframes` dict (for Python).",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    code: z.string().describe("DuckDB SQL query or pandas Python code. For Python, assign your result to `_result`."),
    type: z.enum(["sql", "python"]).default("sql"),
    stage: z.enum(["source", "mapped", "harmonized"]).default("harmonized"),
    sourceFileIds: z.array(z.string().uuid()).optional().describe("For source stage: which specific files to load"),
  }),
  execute: async ({ projectId, code, type, stage, sourceFileIds }) => {
    return executeQuery({ projectId, code, type, stage, sourceFileIds });
  },
});
