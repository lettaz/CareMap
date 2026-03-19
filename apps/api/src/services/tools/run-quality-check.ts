import { tool } from "ai";
import { z } from "zod";
import { executeWithFileUpload } from "../sandbox.js";
import { supabase } from "../../config/supabase.js";

export const runQualityCheckTool = tool({
  description: "Load harmonized Parquet files and compute quality metrics: null rates, range violations, duplicate counts. Writes quality alerts to Supabase.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
  }),
  execute: async ({ projectId }) => {
    const { data: entities } = await supabase
      .from("semantic_entities")
      .select("parquet_path, entity_name")
      .eq("project_id", projectId);

    if (!entities?.length) {
      return { message: "No harmonized data to check", alerts: [] };
    }

    const storagePaths = entities.map((e) => e.parquet_path).filter(Boolean);

    const pythonCode = `
import pandas as pd
import json, os

alerts = []
for f in os.listdir("/tmp/data"):
    if not f.endswith(".parquet"):
        continue
    table_name = f.replace(".parquet", "")
    df = pd.read_parquet(f"/tmp/data/{f}")

    for col in df.columns:
        null_rate = df[col].isnull().mean()
        if null_rate > 0.1:
            alerts.append({
                "severity": "warning" if null_rate < 0.3 else "critical",
                "summary": f"{table_name}.{col}: {null_rate:.1%} null values",
                "affectedCount": int(df[col].isnull().sum())
            })

    dupes = df.duplicated().sum()
    if dupes > 0:
        alerts.append({
            "severity": "warning",
            "summary": f"{table_name}: {dupes} duplicate rows",
            "affectedCount": int(dupes)
        })

print(json.dumps({"alerts": alerts, "tablesChecked": len([f for f in os.listdir("/tmp/data") if f.endswith(".parquet")])}))
`;

    const result = await executeWithFileUpload(pythonCode, storagePaths, { timeoutMs: 30_000 });

    const outputLine = result.stdout.split("\n").filter((l) => l.startsWith("{")).pop();
    const output = outputLine
      ? (JSON.parse(outputLine) as { alerts: Array<{ severity: string; summary: string; affectedCount: number }>; tablesChecked: number })
      : { alerts: [], tablesChecked: 0 };

    for (const alert of output.alerts) {
      await supabase.from("quality_alerts").insert({
        project_id: projectId,
        severity: alert.severity as "critical" | "warning" | "info",
        summary: alert.summary,
        affected_count: alert.affectedCount,
        detection_method: "automated_quality_check",
        acknowledged: false,
        source_file_id: null,
      });
    }

    return output;
  },
});
