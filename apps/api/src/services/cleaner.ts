import { streamText } from "ai";
import { supabase } from "../config/supabase.js";
import { getModel } from "../config/ai.js";
import { createSandbox, getSignedFileUrls, buildFileDownloadPreamble, ENSURE_EXCEL_DEPS } from "./sandbox.js";
import { cleanedPath, uploadFile } from "./storage.js";

export interface CleaningPlan {
  plan: Array<{ column: string; issue: string; fix: string; impact: string }>;
  script: string;
  summary: string;
}

export interface CleaningPlanResult extends CleaningPlan {
  sourceFileId: string;
  actionCount: number;
}

const CLEANING_SYSTEM_PROMPT = `You are a data cleaning expert. Given column profiles with quality flags, propose a cleaning plan.

Analyze each column and decide what transformations are needed. You have FULL FREEDOM — use any pandas/numpy operation.

CRITICAL RULES:
- Use the EXACT column names from the profile data. Access them via df.columns — NEVER hardcode expected column names or create an "expected columns" list.
- NEVER rename columns or normalize column names. Work with whatever names exist in df.
- NEVER create new columns that duplicate existing data. Only add derived columns (flags, parsed versions).
- NEVER use df.dropna() or df = df.dropna(subset=[...]) to handle nulls. This drops rows and causes data loss.
- For nulls: use fillna() with appropriate values (median, mean, mode, 0, "unknown", etc.), interpolation, or flag columns.
- For date parsing: use pd.to_datetime with errors="coerce".
- For type casting: use pd.to_numeric or .astype with error handling.
- Preserve ALL rows unless there are true duplicates.
- Before accessing any column by name, verify it exists: use \`if "col" in df.columns\` guards.

Return a JSON object:
{
  "plan": [
    { "column": "col_name", "issue": "description of the issue", "fix": "what will be done", "impact": "expected result" }
  ],
  "script": "Python pandas/numpy code that transforms df in place. Use log_step(step_num, col, action, len(df), len(df)) to report each step.",
  "summary": "Brief overall explanation"
}

The script has access to: df (DataFrame already loaded), pd, np, json, log_step(step_num, column, action, rows_before, rows_after, warn="").
Do NOT import anything or read/write files — that is handled by the framework.
The column names in the profile below are the EXACT column names in df. Use them verbatim.`;

export async function generateCleaningPlan(
  sourceFileId: string,
  onChunk?: (delta: string) => void,
): Promise<CleaningPlanResult> {
  const { data: profiles } = await supabase
    .from("source_profiles")
    .select()
    .eq("source_file_id", sourceFileId);

  if (!profiles?.length) throw new Error("No profiles found for source file");

  const profileSummary = profiles.map((p) => ({
    column: p.column_name,
    type: p.inferred_type,
    qualityFlags: p.quality_flags,
    nullCount: (p.native_stats as Record<string, unknown>)?.nullCount,
    totalCount: (p.native_stats as Record<string, unknown>)?.count,
    sampleValues: p.sample_values?.slice(0, 5),
    confidence: p.confidence,
  }));

  const stream = streamText({
    model: getModel(),
    messages: [
      { role: "system", content: CLEANING_SYSTEM_PROMPT },
      { role: "user", content: `Column profiles:\n${JSON.stringify(profileSummary, null, 2)}` },
    ],
    temperature: 0.1,
  });

  let accumulated = "";
  for await (const chunk of stream.textStream) {
    accumulated += chunk;
    onChunk?.(chunk);
  }

  const jsonStr = accumulated.replace(/```json\n?|\n?```/g, "").trim();
  const result = JSON.parse(jsonStr) as CleaningPlan;

  return {
    sourceFileId,
    plan: result.plan,
    script: result.script,
    summary: result.summary,
    actionCount: result.plan.length,
  };
}

export interface StepResult {
  step: number;
  column: string;
  action: string;
  rowsBefore: number;
  rowsAfter: number;
  warning?: string;
}

export interface PlaceholderAlert {
  column: string;
  fillValue: string;
  percentage: number;
}

export interface CleaningResult {
  rowsBefore: number;
  rowsAfter: number;
  columnsCleaned: number;
  cleanedStoragePath: string;
  steps: StepResult[];
  summary: Record<string, { before: string; after: string }>;
  script: string;
  placeholderDominated: PlaceholderAlert[];
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
  return `${ENSURE_EXCEL_DEPS}import pandas as pd
import numpy as np
import json, sys

_input_path = "/tmp/data/${inputFilename}"
if _input_path.endswith((".xlsx", ".xls")):
    df = pd.read_excel(_input_path)
elif _input_path.endswith(".parquet"):
    df = pd.read_parquet(_input_path)
else:
    df = pd.read_csv(_input_path)
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

# Sanity check: detect if cleaning filled most values with placeholders
_placeholder_patterns = ['unknown', 'UNKNOWN', 'missing', 'MISSING', 'N/A', 'n/a', 'none', 'NONE']
_bad_fill_cols = []
for _col in df.columns:
    if df[_col].dtype == 'object' or str(df[_col].dtype) == 'string':
        _val_counts = df[_col].value_counts(normalize=True)
        if len(_val_counts) > 0:
            _top_val = str(_val_counts.index[0]).strip()
            _top_pct = _val_counts.iloc[0]
            if _top_pct > 0.8 and any(p in _top_val for p in _placeholder_patterns):
                _bad_fill_cols.append({"column": _col, "fillValue": _top_val, "percentage": round(_top_pct * 100)})

df.to_csv("${outputPath}", index=False)
print(json.dumps({"type": "final", "rowsBefore": rows_before, "rowsAfter": rows_after, "columnsCleaned": len(step_results), "steps": step_results, "summary": summary, "placeholderDominated": _bad_fill_cols}), flush=True)
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
    .select("storage_path, filename, file_type")
    .eq("id", sourceFileId)
    .single();

  if (!sourceFile?.storage_path) {
    throw new Error(`Source file ${sourceFileId} has no storage path`);
  }

  await supabase.from("source_files").update({ status: "cleaning" }).eq("id", sourceFileId);

  const originalFilename = sourceFile.filename as string;
  const fileType = sourceFile.file_type as string | null;
  const isExcel = fileType === "xlsx" || fileType === "xls" || /\.(xlsx|xls)$/i.test(originalFilename);
  const ext = isExcel ? ".xlsx" : ".csv";
  const downloadName = `${sanitizeFilename(originalFilename)}${ext}`;

  const nameMap = new Map([[sourceFile.storage_path as string, downloadName]]);
  const fileUrls = await getSignedFileUrls([sourceFile.storage_path], nameMap);
  const preamble = buildFileDownloadPreamble(fileUrls);

  const cleanedOutputName = `cleaned_${sanitizeFilename(originalFilename)}.csv`;
  const outputFilePath = `/tmp/output/${cleanedOutputName}`;
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
      placeholderDominated?: PlaceholderAlert[];
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
      placeholderDominated: cleanResult.placeholderDominated ?? [],
      cleanedStoragePath: storageDest,
      script,
    };
  } finally {
    await sandbox.kill().catch(() => {});
  }
}
