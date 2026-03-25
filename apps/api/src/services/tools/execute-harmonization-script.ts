import { tool } from "ai";
import { z } from "zod";
import { supabase } from "../../config/supabase.js";
import { createSandbox, getSignedFileUrls, ENSURE_EXCEL_DEPS } from "../sandbox.js";
import { harmonizedTablePath, manifestPath, uploadFile, resolveFileExt } from "../storage.js";
import { updateSemanticLayer } from "../semantic.js";
import { isYoloMode } from "../../lib/yolo.js";
import type { FieldMappingRow } from "../../lib/types/database.js";

export const executeHarmonizationScriptTool = tool({
  description:
    "Execute a previously generated harmonization script in a sandboxed environment. " +
    "Downloads source files, runs the script, uploads harmonized tables to storage, " +
    "and updates the semantic layer. Requires user approval.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    mappingIds: z.array(z.string().uuid()).optional().describe("If omitted, all accepted mappings for the project are used"),
    script: z.string().min(10).describe("The Python harmonization script to execute"),
    nodeId: z
      .string()
      .optional()
      .describe("The harmonize node ID. Output will be namespaced under this node."),
  }),
  needsApproval: async (input) => !(await isYoloMode(input.projectId)),
  execute: async ({ projectId, mappingIds, script, nodeId }) => {
    try {
      let mappings: FieldMappingRow[];

      if (mappingIds?.length) {
        const { data } = await supabase
          .from("field_mappings").select().in("id", mappingIds).eq("status", "accepted");
        mappings = (data ?? []) as FieldMappingRow[];
      } else {
        const { data } = await supabase
          .from("field_mappings").select().eq("project_id", projectId).eq("status", "accepted");
        mappings = (data ?? []) as FieldMappingRow[];
      }

      if (!mappings.length) {
        return { success: false, error: "No accepted mappings found." };
      }

      const sourceIds = [...new Set(mappings.map((m: FieldMappingRow) => m.source_file_id))];
      const { data: sourceFiles } = await supabase
        .from("source_files")
        .select("id, filename, storage_path, cleaned_path, file_type, status")
        .in("id", sourceIds);

      if (!sourceFiles?.length) {
        return { success: false, error: "No source files found for mappings." };
      }

      const storagePaths: string[] = [];
      const downloadNameMap = new Map<string, string>();
      const seenNames = new Map<string, number>();

      for (const sf of sourceFiles) {
        const useCleaned = !!(sf.cleaned_path as string);
        const path = useCleaned ? (sf.cleaned_path as string) : (sf.storage_path as string);
        if (!path) continue;
        const ext = useCleaned ? ".csv" : resolveFileExt(sf.file_type as string | null, path);

        let baseName = (sf.filename as string)
          .replace(/\.(csv|parquet|xlsx|json|txt)$/i, "")
          .replace(/[^a-zA-Z0-9_]/g, "_")
          .toLowerCase();

        const count = seenNames.get(baseName) ?? 0;
        seenNames.set(baseName, count + 1);
        if (count > 0) baseName = `${baseName}_${count}`;

        const downloadName = `${baseName}${ext}`;
        storagePaths.push(path);
        downloadNameMap.set(path, downloadName);
      }

      const fileUrls = await getSignedFileUrls(storagePaths, downloadNameMap);

      const preambleLines = [
        ENSURE_EXCEL_DEPS.trim(),
        "import os, urllib.request",
        'os.makedirs("/tmp/data", exist_ok=True)',
        'os.makedirs("/tmp/harmonized", exist_ok=True)',
      ];
      for (const f of fileUrls) {
        const downloadName = downloadNameMap.get(f.path) ?? f.path.split("/").pop()!;
        preambleLines.push(`urllib.request.urlretrieve("${f.url}", "/tmp/data/${downloadName}")`);
        preambleLines.push(`print(f"Downloaded: ${downloadName}")`);
      }

      const fullCode = `${preambleLines.join("\n")}\n\n${script}`;

      const sandbox = await createSandbox();
      let stdout = "";
      let stderr = "";

      try {
        const execution = await sandbox.runCode(fullCode, {
          timeoutMs: 120_000,
          onStdout: (msg: { line?: string } | string) => {
            const text = typeof msg === "string" ? msg : (msg?.line ?? String(msg));
            stdout += text + "\n";
          },
          onStderr: (msg: { line?: string } | string) => {
            const text = typeof msg === "string" ? msg : (msg?.line ?? String(msg));
            stderr += text + "\n";
          },
        });

        if (execution.error) {
          const detail = `${execution.error.name}: ${execution.error.value}\n${execution.error.traceback ?? ""}`;
          return {
            success: false,
            error: `Script execution failed: ${detail}`,
            retryable: true,
            suggestion: "The script had an error. Review the traceback and call generate_harmonization_script to produce a corrected version.",
            stdout: stdout.slice(0, 1000),
          };
        }

        const manifestLine = stdout.split("\n").filter((l) => l.trim().startsWith("{")).pop();
        if (!manifestLine) {
          return {
            success: false,
            error: `Script produced no manifest. stdout: ${stdout.slice(0, 500)}`,
            retryable: true,
            suggestion: "The script didn't output a manifest. Regenerate the script.",
          };
        }

        let manifest: { tables: Array<{ name: string; rows: number; columns: string[] }> };
        try {
          manifest = JSON.parse(manifestLine);
        } catch {
          return {
            success: false,
            error: `Manifest is malformed JSON: ${manifestLine.slice(0, 300)}`,
            retryable: true,
          };
        }

        if (!manifest.tables?.length) {
          return { success: false, error: "Script produced zero tables." };
        }

        const parquetPaths: string[] = [];
        for (const table of manifest.tables) {
          const csvBytes = await sandbox.files.read(`/tmp/harmonized/${table.name}.csv`);
          const csvBuffer = typeof csvBytes === "string" ? Buffer.from(csvBytes, "utf-8") : Buffer.from(csvBytes);
          const destPath = harmonizedTablePath(projectId, table.name, nodeId);
          await uploadFile(destPath, csvBuffer, "text/csv");
          parquetPaths.push(destPath);
        }

        const manifestBytes = await sandbox.files.read("/tmp/harmonized/manifest.json");
        const manifestBuffer = typeof manifestBytes === "string" ? Buffer.from(manifestBytes, "utf-8") : Buffer.from(manifestBytes);
        await uploadFile(manifestPath(projectId, nodeId), manifestBuffer, "application/json");

        await updateSemanticLayer(projectId, nodeId);

        return {
          success: true,
          tables: manifest.tables,
          totalRecords: manifest.tables.reduce((sum, t) => sum + t.rows, 0),
          parquetPaths,
          nodeId: nodeId ?? null,
        };
      } finally {
        await sandbox.kill().catch(() => {});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isRetryable = message.includes("sandbox") || message.includes("ECONN") || message.includes("fetch");
      return {
        success: false,
        error: message,
        retryable: isRetryable,
        suggestion: isRetryable
          ? "Transient failure. Try calling execute_harmonization_script again with the same script."
          : "Check the script for errors.",
      };
    }
  },
});
