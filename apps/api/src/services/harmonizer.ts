import { supabase } from "../config/supabase.js";
import { executeInSandbox, getSignedFileUrls } from "./sandbox.js";
import { harmonizedTablePath } from "./storage.js";
import { updateSemanticLayer } from "./semantic.js";
import type { FieldMappingRow } from "../lib/types/database.js";
import type { SandboxOptions } from "./sandbox.js";

export interface HarmonizeResult {
  tables: Array<{ name: string; rows: number; columns: string[] }>;
  totalRecords: number;
  parquetPaths: string[];
}

function sqlToPandas(expr: string, targetCol: string): string | null {
  const castMatch = expr.match(/^CAST\((\w+)\s+AS\s+(\w+)\)$/i);
  if (castMatch) {
    const [, , sqlType] = castMatch;
    const upper = sqlType!.toUpperCase();
    if (["BIGINT", "INT", "INTEGER", "DECIMAL", "FLOAT", "DOUBLE", "NUMERIC"].includes(upper)) {
      return `pd.to_numeric(_subset["${targetCol}"], errors="coerce")`;
    }
    if (["TIMESTAMP", "DATETIME", "DATE"].includes(upper)) {
      return `pd.to_datetime(_subset["${targetCol}"], errors="coerce")`;
    }
    return null;
  }

  const tsMatch = expr.match(/^TO_TIMESTAMP\((\w+),\s*'([^']+)'\)$/i);
  if (tsMatch) {
    const pyFmt = tsMatch[2]!
      .replace("DD", "%d").replace("MM", "%m").replace("YYYY", "%Y")
      .replace("HH24", "%H").replace("MI", "%M").replace("SS", "%S");
    return `pd.to_datetime(_subset["${targetCol}"], format="${pyFmt}", errors="coerce")`;
  }

  return null;
}

export function buildHarmonizationScript(
  mappings: FieldMappingRow[],
  sourceFileMap: Map<string, { cleanedPath: string; filename: string; downloadName: string }>,
): string {
  const lines = [
    "import pandas as pd",
    "import json",
    "import os",
    "",
    'os.makedirs("/tmp/harmonized", exist_ok=True)',
    "",
  ];

  const sourceIds = [...new Set(mappings.map((m) => m.source_file_id))];
  for (const sid of sourceIds) {
    const info = sourceFileMap.get(sid);
    if (!info) continue;
    const fname = info.downloadName;
    lines.push(`src_${sid.replace(/-/g, "_")} = pd.read_parquet("/tmp/data/${fname}") if "${fname}".endswith(".parquet") else pd.read_csv("/tmp/data/${fname}", sep=None, engine="python")`);
  }
  lines.push("");

  const byTargetTable = new Map<string, FieldMappingRow[]>();
  for (const m of mappings) {
    const existing = byTargetTable.get(m.target_table) ?? [];
    existing.push(m);
    byTargetTable.set(m.target_table, existing);
  }

  const tableNames: string[] = [];
  for (const [table, tableMappings] of byTargetTable) {
    const varName = table.replace(/-/g, "_");
    tableNames.push(table);
    lines.push(`# Build ${table}`);
    lines.push(`frames_${varName} = []`);

    const bySource = new Map<string, FieldMappingRow[]>();
    for (const m of tableMappings) {
      const existing = bySource.get(m.source_file_id) ?? [];
      existing.push(m);
      bySource.set(m.source_file_id, existing);
    }

    for (const [sid, colMappings] of bySource) {
      const srcVar = `src_${sid.replace(/-/g, "_")}`;
      const accepted = colMappings.filter((m) => m.status === "accepted");

      const seen = new Set<string>();
      const deduped = accepted.filter((m) => {
        if (seen.has(m.target_column)) return false;
        seen.add(m.target_column);
        return true;
      });

      if (deduped.length === 0) continue;

      const cols = deduped.map((m) => `"${m.source_column}"`);
      const renameMap = deduped
        .map((m) => `"${m.source_column}": "${m.target_column}"`)
        .join(", ");

      lines.push(`_cols = [c for c in [${cols.join(", ")}] if c in ${srcVar}.columns]`);
      lines.push(`if _cols:`);
      lines.push(`    _subset = ${srcVar}[_cols].copy()`);
      lines.push(`    _subset = _subset.rename(columns={${renameMap}})`);

      for (const m of deduped) {
        if (m.transformation) {
          const pandas = sqlToPandas(m.transformation, m.target_column);
          if (pandas) {
            lines.push(`    _subset["${m.target_column}"] = ${pandas}`);
          }
        }
      }

      lines.push(`    frames_${varName}.append(_subset)`);
    }

    lines.push(`${varName} = pd.concat(frames_${varName}, ignore_index=True) if frames_${varName} else pd.DataFrame()`);
    lines.push(`${varName}.to_csv("/tmp/harmonized/${table}.csv", index=False)`);
    lines.push(`print(f"Table ${table}: {len(${varName})} rows, {list(${varName}.columns)}")`);
    lines.push("");
  }

  lines.push("manifest = {");
  lines.push('  "tables": [');
  for (const table of tableNames) {
    const varName = table.replace(/-/g, "_");
    lines.push(`    {"name": "${table}", "rows": len(${varName}), "columns": list(${varName}.columns)},`);
  }
  lines.push("  ]");
  lines.push("}");
  lines.push('with open("/tmp/harmonized/manifest.json", "w") as f:');
  lines.push("    json.dump(manifest, f)");
  lines.push("print(json.dumps(manifest))");

  return lines.join("\n");
}

export async function harmonize(
  projectId: string,
  mappingIds: string[],
  onProgress?: (line: string) => void,
): Promise<HarmonizeResult> {
  const { data: mappings, error: mErr } = await supabase
    .from("field_mappings")
    .select()
    .in("id", mappingIds)
    .eq("status", "accepted");

  if (mErr || !mappings?.length) {
    throw new Error("No accepted mappings found");
  }

  const sourceIds = [...new Set(mappings.map((m: FieldMappingRow) => m.source_file_id))];
  const { data: sourceFiles } = await supabase
    .from("source_files")
    .select("id, filename, storage_path, cleaned_path, status")
    .in("id", sourceIds);

  if (!sourceFiles?.length) throw new Error("No source files found for mappings");

  const sourceFileMap = new Map<string, { cleanedPath: string; filename: string; downloadName: string }>();
  const storagePaths: string[] = [];
  const downloadNameMap = new Map<string, string>();

  for (const sf of sourceFiles) {
    const path = (sf.cleaned_path as string) || (sf.storage_path as string);
    if (!path) continue;
    const ext = path.endsWith(".parquet") ? ".parquet" : ".csv";
    const downloadName = `${sf.id}${ext}`;
    sourceFileMap.set(sf.id as string, {
      cleanedPath: path,
      filename: sf.filename as string,
      downloadName,
    });
    storagePaths.push(path);
    downloadNameMap.set(path, downloadName);
  }

  const fileUrls = await getSignedFileUrls(storagePaths);

  const preambleLines = [
    "import os, urllib.request",
    'os.makedirs("/tmp/data", exist_ok=True)',
  ];
  for (const f of fileUrls) {
    const downloadName = downloadNameMap.get(f.path) ?? f.path.split("/").pop()!;
    preambleLines.push(`urllib.request.urlretrieve("${f.url}", "/tmp/data/${downloadName}")`);
    preambleLines.push(`print(f"Downloaded: ${downloadName}")`);
  }
  const preamble = preambleLines.join("\n");

  const script = buildHarmonizationScript(mappings as FieldMappingRow[], sourceFileMap);

  const fullCode = `${preamble}\n\n${script}`;

  const opts: SandboxOptions = { timeoutMs: 120_000, onStdout: onProgress };
  const result = await executeInSandbox(fullCode, [], opts);

  if (result.exitCode !== 0) {
    throw new Error(`Harmonization failed: ${result.stderr}`);
  }

  const manifestLine = result.stdout.split("\n").filter((l) => l.startsWith("{")).pop();
  const manifest = manifestLine
    ? (JSON.parse(manifestLine) as { tables: Array<{ name: string; rows: number; columns: string[] }> })
    : { tables: [] };

  const parquetPaths: string[] = [];
  for (const table of manifest.tables) {
    const destPath = harmonizedTablePath(projectId, table.name);
    parquetPaths.push(destPath);
  }

  await updateSemanticLayer(projectId);

  return {
    tables: manifest.tables,
    totalRecords: manifest.tables.reduce((sum, t) => sum + t.rows, 0),
    parquetPaths,
  };
}
