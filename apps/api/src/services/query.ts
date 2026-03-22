import { supabase } from "../config/supabase.js";
import { getSignedFileUrls, executeInSandbox } from "./sandbox.js";

export type QueryStage = "source" | "mapped" | "harmonized";

export interface QueryRequest {
  projectId: string;
  code: string;
  type: "sql" | "python";
  stage: QueryStage;
  sourceFileIds?: string[];
  /** When stage is harmonized, scope to entities from this harmonize node */
  nodeId?: string;
}

export interface QueryResult {
  rows: unknown[];
  rowCount: number;
  columns?: string[];
  generatedCode: string;
  error?: string;
  executionTimeMs: number;
}

interface ResolvedFile {
  storagePath: string;
  downloadName: string;
}

function sanitizeTableName(filename: string): string {
  return filename
    .replace(/\.(csv|parquet|xlsx|json|txt)$/i, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^(\d)/, "_$1")
    .toLowerCase();
}

async function resolveFiles(
  projectId: string,
  stage: QueryStage,
  sourceFileIds?: string[],
  nodeId?: string,
): Promise<ResolvedFile[]> {
  if (stage === "harmonized") {
    let entityQuery = supabase
      .from("semantic_entities")
      .select("entity_name, parquet_path")
      .eq("project_id", projectId);
    if (nodeId) {
      entityQuery = entityQuery.eq("node_id", nodeId);
    }
    const { data: entities } = await entityQuery;

    return (entities ?? [])
      .filter((e) => e.parquet_path)
      .map((e) => ({
        storagePath: e.parquet_path as string,
        downloadName: `${sanitizeTableName(e.entity_name as string)}.csv`,
      }));
  }

  const query = supabase
    .from("source_files")
    .select("id, filename, storage_path, cleaned_path, status");

  if (sourceFileIds?.length) {
    query.in("id", sourceFileIds);
  } else {
    query.eq("project_id", projectId);
  }

  const { data: files } = await query;
  const seen = new Map<string, number>();

  return (files ?? [])
    .filter((f) => (f.cleaned_path as string) || (f.storage_path as string))
    .map((f) => {
      const storagePath = (f.cleaned_path as string) || (f.storage_path as string);
      const ext = storagePath.endsWith(".parquet") ? ".parquet" : ".csv";
      let baseName = sanitizeTableName(f.filename as string);

      const count = seen.get(baseName) ?? 0;
      seen.set(baseName, count + 1);
      if (count > 0) baseName = `${baseName}_${count}`;

      return { storagePath, downloadName: `${baseName}${ext}` };
    });
}

function buildSqlQueryCode(sql: string): string {
  return `
import subprocess, sys
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "duckdb"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
import duckdb
import json
import os

conn = duckdb.connect()

for f in os.listdir("/tmp/data"):
    table_name = f.rsplit(".", 1)[0]
    ext = f.rsplit(".", 1)[-1]
    if ext == "parquet":
        conn.execute(f"CREATE TABLE {table_name} AS SELECT * FROM read_parquet('/tmp/data/{f}')")
    elif ext == "csv":
        conn.execute(f"CREATE TABLE {table_name} AS SELECT * FROM read_csv('/tmp/data/{f}', auto_detect=true)")

result = conn.execute("""${sql}""").fetchdf()
rows = result.head(1000).to_dict(orient='records')
print(json.dumps({"rows": rows, "rowCount": len(result), "columns": list(result.columns)}))
`;
}

function buildPythonQueryCode(code: string): string {
  return `
import pandas as pd
import json
import os

dataframes = {}
for f in os.listdir("/tmp/data"):
    table_name = f.rsplit(".", 1)[0]
    ext = f.rsplit(".", 1)[-1]
    if ext == "parquet":
        dataframes[table_name] = pd.read_parquet(f"/tmp/data/{f}")
    elif ext == "csv":
        dataframes[table_name] = pd.read_csv(f"/tmp/data/{f}")

${code}

if '_result' in dir():
    if hasattr(_result, 'to_dict'):
        rows = _result.head(1000).to_dict(orient='records')
        print(json.dumps({"rows": rows, "rowCount": len(_result), "columns": list(_result.columns)}))
    elif isinstance(_result, list):
        print(json.dumps({"rows": _result[:1000], "rowCount": len(_result)}))
    else:
        print(json.dumps({"rows": [_result], "rowCount": 1}))
`;
}

export async function executeQuery(request: QueryRequest): Promise<QueryResult> {
  const start = Date.now();
  const userCode = request.code;
  const resolved = await resolveFiles(
    request.projectId,
    request.stage,
    request.sourceFileIds,
    request.nodeId,
  );

  if (resolved.length === 0) {
    return {
      rows: [],
      rowCount: 0,
      generatedCode: userCode,
      error: `No data files found for stage "${request.stage}"`,
      executionTimeMs: Date.now() - start,
    };
  }

  const nameMap = new Map(resolved.map((r) => [r.storagePath, r.downloadName]));
  const fileUrls = await getSignedFileUrls(
    resolved.map((r) => r.storagePath),
    nameMap,
  );

  const pythonCode = request.type === "sql"
    ? buildSqlQueryCode(userCode)
    : buildPythonQueryCode(userCode);

  const result = await executeInSandbox(pythonCode, fileUrls, {
    timeoutMs: 30_000,
    maxResultRows: 1000,
  });

  if (result.exitCode !== 0) {
    return {
      rows: [],
      rowCount: 0,
      generatedCode: userCode,
      error: result.stderr || "Query execution failed",
      executionTimeMs: Date.now() - start,
    };
  }

  const outputLine = result.stdout.split("\n").filter((l) => l.startsWith("{")).pop();
  if (!outputLine) {
    return {
      rows: [],
      rowCount: 0,
      generatedCode: userCode,
      error: "No output from query",
      executionTimeMs: Date.now() - start,
    };
  }

  const parsed = JSON.parse(outputLine) as { rows: unknown[]; rowCount: number; columns?: string[] };
  return {
    ...parsed,
    generatedCode: userCode,
    executionTimeMs: Date.now() - start,
  };
}
