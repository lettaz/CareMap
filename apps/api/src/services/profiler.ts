import Papa from "papaparse";
import * as XLSX from "xlsx";
import { getModel } from "../config/ai.js";
import { generateText } from "ai";
import { supabase } from "../config/supabase.js";
import { AIServiceError } from "../lib/errors.js";
import type { SourceProfileRow } from "../lib/types/database.js";
import type { ProfileColumnEvent, ProfileCompleteEvent } from "../lib/types/api.js";

// ── Types ──

export interface ColumnRename {
  from: string;
  to: string;
  reason: "empty_header" | "xlsx_artifact" | "duplicate";
}

export interface ParseResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  renames: ColumnRename[];
}

export interface ColumnStats {
  columnName: string;
  totalRows: number;
  nullCount: number;
  nullRate: number;
  uniqueCount: number;
  uniqueRate: number;
  detectedType: "string" | "number" | "date" | "boolean" | "mixed";
  min: string | number | null;
  max: string | number | null;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  topValues: Array<{ value: string; count: number }>;
  sampleValues: unknown[];
  patterns: string[];
}

// ── Column Name Normalization ──

const XLSX_ARTIFACT_PATTERN = /^__EMPTY(_\d+)?$/;

function normalizeColumnNames(
  columns: string[],
  rows: Record<string, unknown>[],
): { columns: string[]; rows: Record<string, unknown>[]; renames: ColumnRename[] } {
  const renames: ColumnRename[] = [];
  const usedNames = new Set<string>();
  let unnamedCounter = 0;

  const newColumns = columns.map((original) => {
    const trimmed = original.trim();
    let newName = trimmed;
    let reason: ColumnRename["reason"] | null = null;

    if (!trimmed || trimmed === "") {
      unnamedCounter++;
      newName = `unnamed_${unnamedCounter}`;
      reason = "empty_header";
    } else if (XLSX_ARTIFACT_PATTERN.test(trimmed)) {
      unnamedCounter++;
      newName = `unnamed_${unnamedCounter}`;
      reason = "xlsx_artifact";
    }

    if (usedNames.has(newName)) {
      let suffix = 2;
      while (usedNames.has(`${newName}_${suffix}`)) suffix++;
      const deduped = `${newName}_${suffix}`;
      renames.push({ from: original, to: deduped, reason: reason ?? "duplicate" });
      usedNames.add(deduped);
      return deduped;
    }

    if (reason) {
      renames.push({ from: original, to: newName, reason });
    }

    usedNames.add(newName);
    return newName;
  });

  if (renames.length === 0) return { columns, rows, renames };

  const renameMap = new Map<string, string>();
  columns.forEach((old, i) => {
    if (old !== newColumns[i]) renameMap.set(old, newColumns[i]!);
  });

  const newRows = rows.map((row) => {
    const updated: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      updated[renameMap.get(key) ?? key] = value;
    }
    return updated;
  });

  return { columns: newColumns, rows: newRows, renames };
}

// ── Parsing ──

export function parseCsv(content: string, delimiter?: string): ParseResult {
  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    delimiter: delimiter || undefined,
  });

  const rawColumns = parsed.meta.fields ?? [];
  const normalized = normalizeColumnNames(rawColumns, parsed.data);

  return {
    columns: normalized.columns,
    rows: normalized.rows,
    rowCount: normalized.rows.length,
    renames: normalized.renames,
  };
}

export interface ExcelSheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
}

export function peekExcelSheets(buffer: Buffer): ExcelSheetInfo[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]!;
    const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
    return {
      name,
      rowCount: Math.max(0, range.e.r - range.s.r),
      columnCount: range.e.c - range.s.c + 1,
    };
  });
}

export function parseExcel(buffer: Buffer, targetSheet?: string): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheetName = targetSheet ?? workbook.SheetNames[0];
  if (!sheetName || !workbook.Sheets[sheetName]) {
    return { columns: [], rows: [], rowCount: 0, renames: [] };
  }

  const sheet = workbook.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  const rawColumns = rows.length > 0 ? Object.keys(rows[0]!) : [];
  const normalized = normalizeColumnNames(rawColumns, rows);

  return {
    columns: normalized.columns,
    rows: normalized.rows,
    rowCount: normalized.rows.length,
    renames: normalized.renames,
  };
}

// ── Native Statistics (single-pass) ──

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{2}\.\d{2}\.\d{4}$/,
  /^\d{2}\/\d{2}\/\d{4}$/,
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
  /^\d{2}-\w{3}-\d{4}$/,
];

function isNull(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (typeof v === "string" && v.trim() === "");
}

function detectType(values: unknown[]): ColumnStats["detectedType"] {
  const nonNull = values.filter((v) => !isNull(v));
  if (nonNull.length === 0) return "string";

  let numCount = 0;
  let dateCount = 0;
  let boolCount = 0;

  for (const v of nonNull) {
    if (typeof v === "boolean") {
      boolCount++;
      continue;
    }
    if (typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))) {
      numCount++;
      continue;
    }
    const str = String(v);
    if (str.toLowerCase() === "true" || str.toLowerCase() === "false") {
      boolCount++;
      continue;
    }
    if (DATE_PATTERNS.some((p) => p.test(str))) {
      dateCount++;
    }
  }

  const total = nonNull.length;
  const threshold = 0.7;

  if (boolCount / total >= threshold) return "boolean";
  if (numCount / total >= threshold) return "number";
  if (dateCount / total >= threshold) return "date";
  if ((numCount + dateCount + boolCount) / total < 0.3) return "string";
  return "mixed";
}

function computeNumericStats(nums: number[]): { mean: number; median: number; stdDev: number } {
  const n = nums.length;
  if (n === 0) return { mean: 0, median: 0, stdDev: 0 };

  const mean = nums.reduce((s, v) => s + v, 0) / n;
  const sorted = [...nums].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 : sorted[Math.floor(n / 2)]!;
  const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

  return { mean: Math.round(mean * 100) / 100, median, stdDev: Math.round(Math.sqrt(variance) * 100) / 100 };
}

export function computeColumnStats(
  columns: string[],
  rows: Record<string, unknown>[],
): ColumnStats[] {
  return columns.map((col) => {
    const values = rows.map((r) => r[col]);
    const totalRows = values.length;
    const nullCount = values.filter(isNull).length;
    const nonNullValues = values.filter((v) => !isNull(v));

    const uniqueSet = new Set(nonNullValues.map(String));
    const uniqueCount = uniqueSet.size;

    const detectedType = detectType(nonNullValues);

    let min: string | number | null = null;
    let max: string | number | null = null;
    let mean: number | null = null;
    let median: number | null = null;
    let stdDev: number | null = null;

    if (detectedType === "number") {
      const nums = nonNullValues
        .map((v) => (typeof v === "number" ? v : Number(v)))
        .filter((n) => !isNaN(n));

      if (nums.length > 0) {
        min = Math.min(...nums);
        max = Math.max(...nums);
        const stats = computeNumericStats(nums);
        mean = stats.mean;
        median = stats.median;
        stdDev = stats.stdDev;
      }
    } else if (detectedType === "string" || detectedType === "date") {
      const strs = nonNullValues.map(String).sort();
      if (strs.length > 0) {
        min = strs[0]!;
        max = strs[strs.length - 1]!;
      }
    }

    const freq = new Map<string, number>();
    for (const v of nonNullValues) {
      const key = String(v);
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    const topValues = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));

    const sampleValues = nonNullValues.slice(0, 5);

    const matchedPatterns: string[] = [];
    if (detectedType === "date" || detectedType === "string") {
      for (const v of nonNullValues.slice(0, 20)) {
        for (const p of DATE_PATTERNS) {
          if (p.test(String(v)) && !matchedPatterns.includes(p.source)) {
            matchedPatterns.push(p.source);
          }
        }
      }
    }

    return {
      columnName: col,
      totalRows,
      nullCount,
      nullRate: totalRows > 0 ? Math.round((nullCount / totalRows) * 10000) / 10000 : 0,
      uniqueCount,
      uniqueRate: totalRows > 0 ? Math.round((uniqueCount / totalRows) * 10000) / 10000 : 0,
      detectedType,
      min,
      max,
      mean,
      median,
      stdDev,
      topValues,
      sampleValues,
      patterns: matchedPatterns,
    };
  });
}

// ── LLM Semantic Interpretation ──

const PROFILE_SYSTEM_PROMPT = `You are a clinical data profiling assistant for CareMap.

Given computed column statistics from a healthcare dataset, interpret each column semantically.

For each column provide:
- columnName: exact column name
- inferredType: use the detected type provided
- semanticLabel: a human-readable clinical label in English (e.g., "Fall Risk Score", "Patient ID")
- domain: clinical domain (e.g., "care_assessments", "lab_results", "encounters", "patients")
- confidence: 0-1 score
- qualityFlags: issues detected from the statistics (e.g., "high_null_rate" if nullRate > 0.1, "low_cardinality", "mixed_types", "outlier_values", "missing_header" if the column was auto-renamed from an empty or placeholder header)

Also provide:
- suggestedLabel: descriptive name for the entire dataset
- domain: primary clinical domain
- overallQuality: "good", "fair", or "poor"

Column names may be in German. Translate and interpret accordingly.

Return valid JSON: { "columns": [...], "suggestedLabel": "...", "domain": "...", "overallQuality": "good|fair|poor" }`;

export async function profileColumns(
  columns: string[],
  rows: Record<string, unknown>[],
  renames?: ColumnRename[],
): Promise<{ columns: ProfileColumnEvent[]; summary: ProfileCompleteEvent; stats: ColumnStats[] }> {
  const stats = computeColumnStats(columns, rows);
  const renameSet = new Set((renames ?? []).map((r) => r.to));

  const statsForLlm = stats.map((s) => ({
    columnName: s.columnName,
    detectedType: s.detectedType,
    nullRate: s.nullRate,
    uniqueRate: s.uniqueRate,
    uniqueCount: s.uniqueCount,
    min: s.min,
    max: s.max,
    mean: s.mean,
    topValues: s.topValues.slice(0, 5),
    sampleValues: s.sampleValues,
    patterns: s.patterns,
    wasRenamed: renameSet.has(s.columnName),
  }));

  const { text: content } = await generateText({
    model: getModel(),
    messages: [
      { role: "system", content: PROFILE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Column statistics:\n${JSON.stringify(statsForLlm, null, 2)}`,
      },
    ],
    temperature: 0.1,
  });

  if (!content) throw new AIServiceError("Empty response from profiling model");

  const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
  const result = JSON.parse(jsonStr) as {
    columns: ProfileColumnEvent[];
    suggestedLabel: string;
    domain: string;
    overallQuality: "good" | "fair" | "poor";
  };

  const enrichedColumns = result.columns.map((col) => {
    const stat = stats.find((s) => s.columnName === col.columnName);
    return {
      ...col,
      sampleValues: col.sampleValues?.length ? col.sampleValues : (stat?.sampleValues ?? []),
    };
  });

  return {
    columns: enrichedColumns,
    summary: {
      suggestedLabel: result.suggestedLabel,
      domain: result.domain,
      overallQuality: result.overallQuality,
    },
    stats,
  };
}

// ── Persistence ──

export async function saveProfiles(
  sourceFileId: string,
  profiles: ProfileColumnEvent[],
): Promise<SourceProfileRow[]> {
  const rows = profiles.map((p) => ({
    source_file_id: sourceFileId,
    column_name: p.columnName,
    inferred_type: p.inferredType,
    semantic_label: p.semanticLabel,
    domain: p.domain,
    confidence: p.confidence,
    sample_values: p.sampleValues,
    quality_flags: p.qualityFlags,
    user_corrected: false,
  }));

  const { data, error } = await supabase.from("source_profiles").insert(rows).select();
  if (error) throw new Error(`Failed to save profiles: ${error.message}`);
  return data as SourceProfileRow[];
}
