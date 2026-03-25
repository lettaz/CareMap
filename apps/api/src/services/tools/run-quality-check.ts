import { tool } from "ai";
import { z } from "zod";
import { executeWithFileUpload } from "../sandbox.js";
import { supabase } from "../../config/supabase.js";

export const runQualityCheckTool = tool({
  description:
    "Execute a Python quality-check script against harmonized or source data in an E2B sandbox. " +
    "The script should load files from /tmp/data/, analyze quality, and print a JSON line: " +
    '{\"alerts\": [{\"severity\": \"warning\"|\"critical\"|\"info\", \"summary\": \"...\", \"affectedCount\": N}], \"tablesChecked\": N}. ' +
    "The framework writes alerts to Supabase. " +
    "You write the script — check for null rates, duplicates, outliers, schema violations, referential integrity, " +
    "or anything else relevant to the data.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    script: z
      .string()
      .describe(
        "Python script to run quality checks. Files are in /tmp/data/ (csv/parquet). " +
        "Must print one JSON line with {alerts: [...], tablesChecked: N}.",
      ),
    description: z.string().describe("Human-readable summary of what this quality check does"),
    nodeId: z.string().optional().describe("The quality node ID for scoping alerts"),
    harmonizeNodeId: z
      .string()
      .optional()
      .describe("Upstream harmonize node ID to scope entity loading"),
  }),
  execute: async ({ projectId, script, description, nodeId, harmonizeNodeId }) => {
    let entitiesQuery = supabase
      .from("semantic_entities")
      .select("parquet_path, entity_name")
      .eq("project_id", projectId);
    if (harmonizeNodeId) {
      entitiesQuery = entitiesQuery.eq("node_id", harmonizeNodeId);
    }
    const { data: entities } = await entitiesQuery;

    if (!entities?.length) {
      return { success: false, message: "No harmonized data to check", alerts: [] };
    }

    const storagePaths: string[] = [];
    const nameMap = new Map<string, string>();
    for (const e of entities) {
      if (!e.parquet_path) continue;
      storagePaths.push(e.parquet_path);
      const entityName = (e.entity_name as string)
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .toLowerCase();
      nameMap.set(e.parquet_path, `${entityName}.csv`);
    }

    const wrappedScript = `import pandas as pd
import numpy as np
import json, os

dataframes = {}
for f in os.listdir("/tmp/data"):
    path = f"/tmp/data/{f}"
    if f.endswith(".parquet"):
        dataframes[f.replace(".parquet", "")] = pd.read_parquet(path)
    elif f.endswith(".csv"):
        dataframes[f.replace(".csv", "")] = pd.read_csv(path)

alerts = []
tables_checked = 0

def add_alert(severity, summary, affected_count=0):
    alerts.append({"severity": severity, "summary": summary, "affectedCount": affected_count})

# ---- LLM-generated quality check logic ----
${script}
# ---- end quality check logic ----

print(json.dumps({"alerts": alerts, "tablesChecked": tables_checked}))
`;

    try {
      const result = await executeWithFileUpload(wrappedScript, storagePaths, { timeoutMs: 60_000 }, nameMap);

      const outputLine = result.stdout.split("\n").filter((l) => l.startsWith("{")).pop();
      const output = outputLine
        ? (JSON.parse(outputLine) as {
            alerts: Array<{ severity: string; summary: string; affectedCount: number }>;
            tablesChecked: number;
          })
        : { alerts: [], tablesChecked: 0 };

      for (const alert of output.alerts) {
        await supabase.from("quality_alerts").insert({
          project_id: projectId,
          node_id: nodeId ?? null,
          severity: alert.severity as "critical" | "warning" | "info",
          summary: alert.summary,
          affected_count: alert.affectedCount,
          detection_method: description,
          acknowledged: false,
          source_file_id: null,
        });
      }

      return {
        success: true,
        ...output,
        script: wrappedScript,
        description,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        retryable: message.includes("sandbox") || message.includes("ECONN"),
        suggestion: "Check the script for syntax errors or try again.",
      };
    }
  },
});
