import { supabase } from "../config/supabase.js";
import { createSandbox, getSignedFileUrls, buildFileDownloadPreamble } from "./sandbox.js";
import { cleanedPath, uploadFile } from "./storage.js";

export interface StepResult {
  step: number;
  column: string;
  action: string;
  rowsBefore: number;
  rowsAfter: number;
  warning?: string;
}

export interface CleaningResult {
  rowsBefore: number;
  rowsAfter: number;
  columnsCleaned: number;
  cleanedStoragePath: string;
  steps: StepResult[];
  summary: Record<string, { before: string; after: string }>;
  script: string;
}

function sanitizeFilename(raw: string): string {
  return raw
    .replace(/\.(csv|parquet|xlsx|json|txt)$/i, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase();
}

export function wrapCleaningScript(
  userScript: string,
  inputFilename: string,
  outputPath: string,
): string {
  return `import pandas as pd
import numpy as np
import json, sys

df = pd.read_csv("/tmp/data/${inputFilename}") if "${inputFilename}".endswith(".csv") else pd.read_parquet("/tmp/data/${inputFilename}")
rows_before = len(df)
step_results = []
summary = {}

def log_step(step_num, column, action, rows_before_step, rows_after_step, warn=""):
    step_results.append({"step": step_num, "column": column, "action": action, "rowsBefore": rows_before_step, "rowsAfter": rows_after_step, "warning": warn})
    print(json.dumps({"type": "step_complete", **step_results[-1]}), flush=True)

# ---- LLM-generated cleaning logic ----
${userScript}
# ---- end cleaning logic ----

rows_after = len(df)
df.to_csv("${outputPath}", index=False)
print(json.dumps({"type": "final", "rowsBefore": rows_before, "rowsAfter": rows_after, "columnsCleaned": len(step_results), "steps": step_results, "summary": summary}), flush=True)
`;
}

export async function executeCleaning(
  projectId: string,
  sourceFileId: string,
  userScript: string,
  onProgress?: (line: string) => void,
): Promise<CleaningResult> {
  const { data: sourceFile } = await supabase
    .from("source_files")
    .select("storage_path, filename")
    .eq("id", sourceFileId)
    .single();

  if (!sourceFile?.storage_path) {
    throw new Error(`Source file ${sourceFileId} has no storage path`);
  }

  await supabase.from("source_files").update({ status: "cleaning" }).eq("id", sourceFileId);

  const originalFilename = sourceFile.filename as string;
  const downloadName = `${sanitizeFilename(originalFilename)}.csv`;

  const nameMap = new Map([[sourceFile.storage_path as string, downloadName]]);
  const fileUrls = await getSignedFileUrls([sourceFile.storage_path], nameMap);
  const preamble = buildFileDownloadPreamble(fileUrls);

  const outputFilePath = `/tmp/output/cleaned_${downloadName}`;
  const script = wrapCleaningScript(userScript, downloadName, outputFilePath);

  const fullCode = `
${preamble}
import os
os.makedirs("/tmp/output", exist_ok=True)

${script}
`;

  const sandbox = await createSandbox();
  let stdout = "";
  let stderr = "";

  try {
    const execution = await sandbox.runCode(fullCode, {
      timeoutMs: 120_000,
      onStdout: (msg: { line?: string } | string) => {
        const line = typeof msg === "string" ? msg : (msg.line ?? "");
        stdout += line + "\n";
        onProgress?.(line);
      },
      onStderr: (msg: { line?: string } | string) => {
        stderr += typeof msg === "string" ? msg : (msg.line ?? "");
      },
    });

    if (execution.error) {
      await supabase.from("source_files").update({ status: "error" }).eq("id", sourceFileId);
      const retries = (execution.error as unknown as { retryCount?: number }).retryCount ?? 0;
      throw new Error(
        `Cleaning sandbox error (exit=${execution.error.name ? 1 : 0}, retries=${retries}): ` +
        `${execution.error.name}: ${execution.error.value}`,
      );
    }

    const finalLine = stdout.split("\n").reverse().find((l) => l.includes('"type":"final"') || l.includes('"type": "final"'));
    if (!finalLine) {
      const legacyLine = stdout.split("\n").find((l) => l.startsWith("{") && l.includes("rowsBefore"));
      if (!legacyLine) {
        await supabase.from("source_files").update({ status: "error" }).eq("id", sourceFileId);
        throw new Error(
          `Cleaning produced no output. ` +
          `stdout: ${stdout.slice(0, 500) || "(empty)"}. ` +
          `stderr: ${stderr.slice(0, 500) || "(empty)"}`,
        );
      }
    }

    const outputJson = finalLine ?? stdout.split("\n").find((l) => l.startsWith("{"))!;
    let cleanResult: {
      rowsBefore: number;
      rowsAfter: number;
      columnsCleaned: number;
      steps?: StepResult[];
      summary: Record<string, { before: string; after: string }>;
    };

    try {
      cleanResult = JSON.parse(outputJson);
    } catch {
      await supabase.from("source_files").update({ status: "error" }).eq("id", sourceFileId);
      throw new Error(`Cleaning output is malformed JSON: ${outputJson.slice(0, 300)}`);
    }

    if (cleanResult.rowsAfter === 0 && cleanResult.rowsBefore > 0) {
      console.warn(`[cleaner] Warning: cleaning reduced ${cleanResult.rowsBefore} rows to 0 for source ${sourceFileId}`);
    }

    const csvBytes = await sandbox.files.read(outputFilePath);
    const csvBuffer = typeof csvBytes === "string"
      ? Buffer.from(csvBytes, "utf-8")
      : Buffer.from(csvBytes);

    const storageDest = cleanedPath(projectId, sourceFileId);
    await uploadFile(storageDest, csvBuffer, "text/csv");

    await supabase
      .from("source_files")
      .update({
        cleaned_path: storageDest,
        status: "clean",
      })
      .eq("id", sourceFileId);

    return {
      ...cleanResult,
      steps: cleanResult.steps ?? [],
      cleanedStoragePath: storageDest,
      script,
    };
  } finally {
    await sandbox.kill().catch(() => {});
  }
}
