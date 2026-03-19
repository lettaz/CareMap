import { tool } from "ai";
import { z } from "zod";
import { executeWithFileUpload } from "../sandbox.js";
import { supabase } from "../../config/supabase.js";

export const runScriptTool = tool({
  description: "Execute arbitrary Python code in an E2B sandbox for complex analytics (correlations, regressions, custom pandas). The agent writes Python, user approves, and it runs in an isolated sandbox.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    code: z.string().describe("Python code to execute"),
    description: z.string().describe("Human-readable description of what this script does"),
    sourceFileIds: z.array(z.string().uuid()).optional(),
  }),
  needsApproval: true,
  execute: async ({ projectId, code, description, sourceFileIds }) => {
    const storagePaths: string[] = [];

    if (sourceFileIds?.length) {
      const { data: files } = await supabase
        .from("source_files")
        .select("cleaned_path, storage_path")
        .in("id", sourceFileIds);

      for (const f of files ?? []) {
        const path = (f.cleaned_path as string) || (f.storage_path as string);
        if (path) storagePaths.push(path);
      }
    } else {
      const { data: entities } = await supabase
        .from("semantic_entities")
        .select("parquet_path")
        .eq("project_id", projectId);

      for (const e of entities ?? []) {
        if (e.parquet_path) storagePaths.push(e.parquet_path);
      }
    }

    const wrappedCode = `
import json
${code}

if '_result' in dir():
    if hasattr(_result, 'to_dict'):
        print(json.dumps({"result": _result.head(1000).to_dict(orient='records')}))
    else:
        print(json.dumps({"result": _result}))
`;

    const result = await executeWithFileUpload(wrappedCode, storagePaths, { timeoutMs: 60_000 });

    if (result.exitCode !== 0) {
      return { error: result.stderr, description };
    }

    const outputLine = result.stdout.split("\n").filter((l) => l.startsWith("{")).pop();
    return {
      description,
      output: outputLine ? JSON.parse(outputLine) : { stdout: result.stdout },
    };
  },
});
