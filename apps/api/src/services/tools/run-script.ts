import { tool } from "ai";
import { z } from "zod";
import { executeWithFileUpload } from "../sandbox.js";
import { supabase } from "../../config/supabase.js";
import { isYoloMode } from "../../lib/yolo.js";
import { resolveFileExt } from "../storage.js";

export const runScriptTool = tool({
  description:
    "Execute arbitrary Python code in an E2B sandbox for complex analytics, ML models, or statistical tests. " +
    "The sandbox has pandas, numpy, scipy, and scikit-learn available. " +
    "Assign your result to `_result` (DataFrame, list, or dict). " +
    "Data files are auto-loaded into /tmp/data/.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    code: z.string().describe("Python code to execute. Assign result to `_result`."),
    description: z.string().describe("Human-readable description of what this script does"),
    sourceFileIds: z.array(z.string().uuid()).optional(),
    nodeId: z.string().optional().describe("When loading harmonized data, scope to entities from this harmonize node"),
  }),
  needsApproval: async (input) => !(await isYoloMode(input.projectId)),
  execute: async ({ projectId, code, description, sourceFileIds, nodeId }) => {
    try {
      const storagePaths: string[] = [];
      const nameMap = new Map<string, string>();
      const seenNames = new Map<string, number>();

      function trackName(path: string, rawName: string, fileType?: string | null) {
        storagePaths.push(path);
        let baseName = rawName
          .replace(/\.(csv|parquet|xlsx|json|txt)$/i, "")
          .replace(/[^a-zA-Z0-9_]/g, "_")
          .toLowerCase();
        const count = seenNames.get(baseName) ?? 0;
        seenNames.set(baseName, count + 1);
        if (count > 0) baseName = `${baseName}_${count}`;
        const ext = resolveFileExt(fileType ?? null, path);
        nameMap.set(path, `${baseName}${ext}`);
      }

      if (sourceFileIds?.length) {
        const { data: files } = await supabase
          .from("source_files")
          .select("filename, cleaned_path, storage_path, file_type")
          .in("id", sourceFileIds);

        for (const f of files ?? []) {
          const useCleaned = !!(f.cleaned_path as string);
          const path = useCleaned ? (f.cleaned_path as string) : (f.storage_path as string);
          const fileType = useCleaned ? null : (f.file_type as string | null);
          if (path) trackName(path, f.filename as string, fileType);
        }
      } else {
        let entitiesQuery = supabase
          .from("semantic_entities")
          .select("entity_name, parquet_path")
          .eq("project_id", projectId);

        if (nodeId) entitiesQuery = entitiesQuery.eq("node_id", nodeId);

        const { data: entities } = await entitiesQuery;

        for (const e of entities ?? []) {
          if (e.parquet_path) trackName(e.parquet_path, e.entity_name as string);
        }
      }

      const wrappedCode = `
import json
${code}

if '_result' in dir():
    if hasattr(_result, 'to_dict'):
        print(json.dumps({"result": _result.head(1000).to_dict(orient='records')}))
    elif isinstance(_result, dict):
        print(json.dumps({"result": _result}))
    elif isinstance(_result, list):
        print(json.dumps({"result": _result[:1000]}))
    else:
        print(json.dumps({"result": str(_result)}))
`;

      const result = await executeWithFileUpload(wrappedCode, storagePaths, { timeoutMs: 120_000 }, nameMap);

      if (result.exitCode !== 0) {
        const errDetail = result.stderr || result.stdout || "(no output)";
        const isRetryable = errDetail.includes("ECONN") || errDetail.includes("sandbox") || errDetail.includes("port");
        return {
          success: false,
          error: errDetail,
          description,
          generatedCode: code,
          retryable: isRetryable,
          suggestion: isRetryable
            ? "Transient sandbox failure. Try calling run_script again."
            : "Check the Python code for syntax errors, missing imports, or incorrect file paths.",
        };
      }

      const outputLine = result.stdout.split("\n").filter((l) => l.startsWith("{")).pop();

      if (!outputLine) {
        return {
          success: false,
          error: "Script ran but produced no JSON output. Make sure to assign your result to `_result`.",
          description,
          generatedCode: code,
          stdout: result.stdout.slice(0, 500),
          retryable: false,
          suggestion: "Ensure your code assigns the result to `_result` (a DataFrame, dict, or list).",
        };
      }

      return {
        success: true,
        description,
        generatedCode: code,
        output: JSON.parse(outputLine),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        description,
        generatedCode: code,
        retryable: true,
        suggestion: "An unexpected error occurred. Try calling run_script again.",
      };
    }
  },
});
