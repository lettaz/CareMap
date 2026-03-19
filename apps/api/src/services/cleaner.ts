import { supabase } from "../config/supabase.js";
import { executeInSandbox, getSignedFileUrls, buildFileDownloadPreamble } from "./sandbox.js";
import { cleanedPath } from "./storage.js";
import type { SandboxOptions } from "./sandbox.js";

export interface CleaningAction {
  column: string;
  action: "parseDate" | "fillNulls" | "normalizeString" | "castType" | "deduplicateRows" | "convertUnit";
  params: Record<string, unknown>;
  reason: string;
}

export interface CleaningResult {
  rowsBefore: number;
  rowsAfter: number;
  columnsCleaned: number;
  cleanedStoragePath: string;
  summary: Record<string, { before: string; after: string }>;
}

const ACTION_TEMPLATES: Record<CleaningAction["action"], (col: string, params: Record<string, unknown>) => string> = {
  parseDate: (col, params) => {
    const fmt = params.format ? `, format="${params.format}"` : "";
    return `df["${col}"] = pd.to_datetime(df["${col}"], errors="coerce"${fmt})`;
  },
  fillNulls: (col, params) => {
    const strategy = (params.strategy as string) ?? "drop";
    if (strategy === "drop") return `df = df.dropna(subset=["${col}"])`;
    if (strategy === "mean") return `df["${col}"] = df["${col}"].fillna(df["${col}"].mean())`;
    if (strategy === "median") return `df["${col}"] = df["${col}"].fillna(df["${col}"].median())`;
    if (strategy === "mode") return `df["${col}"] = df["${col}"].fillna(df["${col}"].mode()[0])`;
    if (strategy === "value") return `df["${col}"] = df["${col}"].fillna(${JSON.stringify(params.value)})`;
    return `df = df.dropna(subset=["${col}"])`;
  },
  normalizeString: (col) =>
    `df["${col}"] = df["${col}"].astype(str).str.strip().str.lower()`,
  castType: (col, params) => {
    const target = params.type as string;
    if (target === "number") return `df["${col}"] = pd.to_numeric(df["${col}"], errors="coerce")`;
    if (target === "string") return `df["${col}"] = df["${col}"].astype(str)`;
    if (target === "boolean") return `df["${col}"] = df["${col}"].astype(bool)`;
    return `df["${col}"] = df["${col}"].astype("${target}")`;
  },
  deduplicateRows: (_col, params) => {
    const cols = (params.columns as string[]) ?? [];
    const subset = cols.length > 0 ? `subset=${JSON.stringify(cols)}` : "";
    return `df = df.drop_duplicates(${subset})`;
  },
  convertUnit: (col, params) =>
    `df["${col}"] = df["${col}"] * ${params.factor ?? 1}`,
};

export function buildCleaningScript(
  actions: CleaningAction[],
  inputFilename: string,
  outputPath: string,
): string {
  const lines = [
    "import pandas as pd",
    "import json",
    "",
    `df = pd.read_csv("/tmp/data/${inputFilename}") if "${inputFilename}".endswith(".csv") else pd.read_parquet("/tmp/data/${inputFilename}")`,
    `rows_before = len(df)`,
    `summary = {}`,
    "",
  ];

  for (const action of actions) {
    const template = ACTION_TEMPLATES[action.action];
    if (!template) continue;

    lines.push(`# ${action.reason}`);
    lines.push(`_before = df["${action.column}"].describe().to_dict() if "${action.column}" in df.columns else {}`);
    lines.push(template(action.column, action.params));
    lines.push(`_after = df["${action.column}"].describe().to_dict() if "${action.column}" in df.columns else {}`);
    lines.push(`summary["${action.column}"] = {"before": str(_before), "after": str(_after)}`);
    lines.push("");
  }

  lines.push(`df.to_parquet("${outputPath}", index=False)`);
  lines.push(`rows_after = len(df)`);
  lines.push(`print(json.dumps({"rowsBefore": rows_before, "rowsAfter": rows_after, "columnsCleaned": ${actions.length}, "summary": summary}))`);

  return lines.join("\n");
}

export async function executeCleaning(
  projectId: string,
  sourceFileId: string,
  actions: CleaningAction[],
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

  const fileUrls = await getSignedFileUrls([sourceFile.storage_path]);
  const preamble = buildFileDownloadPreamble(fileUrls);
  const outputFilePath = "/tmp/output/cleaned.parquet";
  const script = buildCleaningScript(actions, sourceFile.storage_path.split("/").pop()!, outputFilePath);

  const fullCode = `
${preamble}
import os
os.makedirs("/tmp/output", exist_ok=True)

${script}

with open("${outputFilePath}", "rb") as f:
    _parquet_bytes = f.read()
print("__PARQUET_SIZE__:" + str(len(_parquet_bytes)))
`;

  const opts: SandboxOptions = { timeoutMs: 60_000, onStdout: onProgress };
  const result = await executeInSandbox(fullCode, fileUrls, opts);

  if (result.exitCode !== 0) {
    const errDetail = result.stderr || result.stdout || "(no output captured)";
    await supabase.from("source_files").update({ status: "error" }).eq("id", sourceFileId);
    throw new Error(`Cleaning sandbox error (exit=${result.exitCode}, retries=${result.retryCount}): ${errDetail}`);
  }

  const outputLine = result.stdout
    .split("\n")
    .find((l) => l.startsWith("{"));

  if (!outputLine) {
    await supabase.from("source_files").update({ status: "error" }).eq("id", sourceFileId);
    throw new Error(
      `Cleaning produced no output. ` +
      `stdout: ${result.stdout.slice(0, 500) || "(empty)"}. ` +
      `stderr: ${result.stderr.slice(0, 500) || "(empty)"}`
    );
  }

  let cleanResult: { rowsBefore: number; rowsAfter: number; columnsCleaned: number; summary: Record<string, { before: string; after: string }> };
  try {
    cleanResult = JSON.parse(outputLine);
  } catch {
    await supabase.from("source_files").update({ status: "error" }).eq("id", sourceFileId);
    throw new Error(`Cleaning output is malformed JSON: ${outputLine.slice(0, 300)}`);
  }

  if (cleanResult.rowsAfter === 0 && cleanResult.rowsBefore > 0) {
    console.warn(`[cleaner] Warning: cleaning reduced ${cleanResult.rowsBefore} rows to 0 for source ${sourceFileId}`);
  }

  const storageDest = cleanedPath(projectId, sourceFileId);

  await supabase
    .from("source_files")
    .update({ cleaned_path: storageDest, status: "clean" })
    .eq("id", sourceFileId);

  return {
    ...cleanResult,
    cleanedStoragePath: storageDest,
  };
}
