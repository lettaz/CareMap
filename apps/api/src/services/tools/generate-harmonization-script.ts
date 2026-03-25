import { tool, generateText } from "ai";
import { z } from "zod";
import { getModel } from "../../config/ai.js";
import { supabase } from "../../config/supabase.js";
import { resolveFileExt } from "../storage.js";
import type { FieldMappingRow } from "../../lib/types/database.js";

const HARMONIZATION_PROMPT = `You are a senior data engineer writing a Python pandas script to harmonize clinical data.

You will receive:
1. Source files (with their columns, types, and sample data)
2. A target schema (tables with columns, types, descriptions)
3. Accepted field mappings (source_file.column → target_table.column)

Write a pandas script that:

## File Loading
- Source files are already downloaded to /tmp/data/ with the exact filenames provided.
- Use pd.read_csv(path, sep=None, engine="python") for CSV, pd.read_parquet(path) for Parquet, pd.read_excel(path) for .xlsx/.xls files.

## Intelligent Merging (CRITICAL)
- Do NOT blindly pd.concat all source frames into each target table.
- Instead, analyze which sources contribute which columns to each target table.
- If multiple sources map to the SAME target table but provide DIFFERENT columns:
  - Identify join keys (columns that appear in both sources for the same table, e.g. patient_id).
  - Use pd.merge (outer join) on shared keys to combine complementary data.
  - This avoids null-filled rows from concat when one source has columns another doesn't.
- If multiple sources map the SAME columns to the same target table (true duplicates):
  - Use pd.concat followed by drop_duplicates on primary key columns.
- If a source is the sole contributor to a target table, just rename and use it directly.

## Column Handling
- Only select source columns that exist in the DataFrame (guard with column existence checks).
- Rename columns per the mappings.
- After rename, drop duplicate column names if any: df.loc[:, ~df.columns.duplicated(keep="first")]

## Type Conversions
- Apply transformations from the mappings (CAST, TO_TIMESTAMP, etc.) using pd.to_numeric, pd.to_datetime.
- Use errors="coerce" to handle conversion failures gracefully.

## Deduplication
- For each target table, identify the primary key column(s) — typically "id" or "source_*_id" columns.
- Drop duplicates by primary key, keeping the first occurrence.

## Output
- Write each target table to /tmp/harmonized/{table_name}.csv (index=False).
- Print table stats: print(f"Table {name}: {len(df)} rows, {list(df.columns)}")
- At the end, write a manifest.json to /tmp/harmonized/manifest.json:
  {"tables": [{"name": "...", "rows": N, "columns": ["..."]}]}
- Print the manifest JSON on its own line at the very end.

## Requirements
- Create /tmp/harmonized/ directory at the start.
- Import only: pandas, json, os. openpyxl is pre-installed for Excel support.
- Handle edge cases: empty DataFrames, missing columns, type mismatches.
- NEVER use display() or show() — only print().

Return ONLY the Python code, no markdown fences, no explanation.`;

interface SourceContext {
  fileId: string;
  filename: string;
  downloadName: string;
  columns: Array<{ name: string; type: string; semanticLabel: string | null }>;
}

interface SchemaTable {
  name: string;
  description?: string;
  columns: Array<{ name: string; type: string; description?: string; required?: boolean }>;
}

function mergeActiveSchemasForTransformNodes(
  rows: Array<{ tables: unknown; node_id: string | null; version: number }>,
): SchemaTable[] {
  const bestByNode = new Map<string, { tables: SchemaTable[]; version: number }>();
  for (const row of rows) {
    const nid = row.node_id as string | null;
    if (!nid) continue;
    const ver = row.version as number;
    const prev = bestByNode.get(nid);
    if (!prev || ver > prev.version) {
      bestByNode.set(nid, { tables: (row.tables as SchemaTable[]) ?? [], version: ver });
    }
  }

  const tableMap = new Map<string, SchemaTable>();
  for (const { tables } of bestByNode.values()) {
    for (const t of tables) {
      const existing = tableMap.get(t.name);
      if (!existing) {
        tableMap.set(t.name, { ...t, columns: [...t.columns] });
        continue;
      }
      const colByName = new Map(existing.columns.map((c) => [c.name, c] as const));
      for (const c of t.columns) {
        if (!colByName.has(c.name)) colByName.set(c.name, c);
      }
      tableMap.set(t.name, { ...existing, columns: [...colByName.values()] });
    }
  }
  return [...tableMap.values()];
}

export const generateHarmonizationScriptTool = tool({
  description:
    "Analyze accepted mappings, source files, and target schema, then use AI to generate " +
    "an intelligent pandas harmonization script with proper merges, deduplication, and type " +
    "conversions. Returns the script for user review before execution.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    mappingIds: z.array(z.string().uuid()).optional().describe("If omitted, all accepted mappings for the project are used"),
    nodeId: z
      .string()
      .optional()
      .describe("The harmonize node ID. Used to resolve upstream transforms and scope the output."),
  }),
  execute: async ({ projectId, mappingIds, nodeId }) => {
    try {
      let mappings: FieldMappingRow[];

      if (mappingIds?.length) {
        const { data, error } = await supabase
          .from("field_mappings").select().in("id", mappingIds).eq("status", "accepted");
        if (error || !data?.length) {
          return { success: false, error: "No accepted mappings found for the given IDs." };
        }
        mappings = data as FieldMappingRow[];
      } else {
        const { data, error } = await supabase
          .from("field_mappings").select().eq("project_id", projectId).eq("status", "accepted");
        if (error || !data?.length) {
          return { success: false, error: "No accepted mappings found.", suggestion: "Accept mappings in the Transform panel first." };
        }
        mappings = data as FieldMappingRow[];
      }

      const sourceIds = [...new Set(mappings.map((m: FieldMappingRow) => m.source_file_id))];

      let scopedSchemaTables: SchemaTable[] | null = null;
      if (nodeId) {
        const { data: edges } = await supabase
          .from("pipeline_edges")
          .select("source_node_id")
          .eq("target_node_id", nodeId);

        const upstreamNodeIds = (edges ?? []).map((e) => e.source_node_id as string);
        if (upstreamNodeIds.length) {
          const { data: upstreamNodes } = await supabase
            .from("pipeline_nodes")
            .select("id, node_type")
            .in("id", upstreamNodeIds);

          const transformNodeIds = (upstreamNodes ?? [])
            .filter((n) => n.node_type === "transform")
            .map((n) => n.id as string);

          if (transformNodeIds.length) {
            const { data: schemaRows } = await supabase
              .from("target_schemas")
              .select("tables, node_id, version")
              .eq("project_id", projectId)
              .eq("status", "active")
              .in("node_id", transformNodeIds);

            const merged = schemaRows?.length
              ? mergeActiveSchemasForTransformNodes(
                  schemaRows as Array<{ tables: unknown; node_id: string | null; version: number }>,
                )
              : [];
            if (merged.length) scopedSchemaTables = merged;
          }
        }
      }

      const [{ data: sourceFiles }, { data: profiles }, { data: projectSchemaRow }] = await Promise.all([
        supabase.from("source_files").select("id, filename, storage_path, cleaned_path, file_type, status").in("id", sourceIds),
        supabase.from("source_profiles").select("source_file_id, column_name, inferred_type, semantic_label").in("source_file_id", sourceIds),
        scopedSchemaTables === null
          ? supabase
              .from("target_schemas")
              .select("tables")
              .eq("project_id", projectId)
              .eq("status", "active")
              .order("version", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null as { tables: unknown } | null }),
      ]);

      const schemaTables: SchemaTable[] =
        scopedSchemaTables ?? ((projectSchemaRow?.tables as SchemaTable[]) ?? []);

      if (!sourceFiles?.length) {
        return { success: false, error: "No source files found for mappings." };
      }

      const seenNames = new Map<string, number>();
      const sourceContexts: SourceContext[] = [];

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

        const cols = (profiles ?? [])
          .filter((p) => (p.source_file_id as string) === sf.id)
          .map((p) => ({
            name: p.column_name as string,
            type: p.inferred_type as string,
            semanticLabel: p.semantic_label as string | null,
          }));

        sourceContexts.push({
          fileId: sf.id as string,
          filename: sf.filename as string,
          downloadName: `${baseName}${ext}`,
          columns: cols,
        });
      }

      const mappingsByTable = new Map<string, FieldMappingRow[]>();
      for (const m of mappings as FieldMappingRow[]) {
        const group = mappingsByTable.get(m.target_table) ?? [];
        group.push(m);
        mappingsByTable.set(m.target_table, group);
      }

      const contextForLLM = {
        sourceFiles: sourceContexts.map((s) => ({
          fileId: s.fileId,
          filename: s.filename,
          downloadName: s.downloadName,
          path: `/tmp/data/${s.downloadName}`,
          columns: s.columns,
        })),
        targetSchema: schemaTables,
        mappings: (mappings as FieldMappingRow[]).map((m) => {
          const src = sourceContexts.find((s) => s.fileId === m.source_file_id);
          return {
            sourceFile: src?.downloadName ?? m.source_file_id,
            sourcePath: `/tmp/data/${src?.downloadName ?? m.source_file_id}`,
            sourceColumn: m.source_column,
            targetTable: m.target_table,
            targetColumn: m.target_column,
            transformation: m.transformation,
          };
        }),
        targetTables: [...mappingsByTable.keys()],
      };

      const { text: script } = await generateText({
        model: getModel(),
        messages: [
          { role: "system", content: HARMONIZATION_PROMPT },
          { role: "user", content: `Context:\n${JSON.stringify(contextForLLM, null, 2)}` },
        ],
        temperature: 0.1,
      });

      if (!script?.trim()) {
        return { success: false, error: "AI returned an empty script.", retryable: true };
      }

      const cleanScript = script.replace(/^```python\n?|^```\n?|\n?```$/gm, "").trim();

      const summary = {
        nodeId: nodeId ?? null,
        sourceFileCount: sourceContexts.length,
        sourceFiles: sourceContexts.map((s) => s.filename),
        targetTableCount: mappingsByTable.size,
        targetTables: [...mappingsByTable.keys()],
        totalMappings: mappings.length,
        downloadNames: sourceContexts.map((s) => s.downloadName),
      };

      return {
        success: true,
        script: cleanScript,
        summary,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        retryable: true,
        suggestion: "An error occurred while generating the script. Try again.",
      };
    }
  },
});
