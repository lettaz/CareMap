import { tool } from "ai";
import { z } from "zod";
import { getModel } from "../../config/ai.js";
import { generateText } from "ai";
import { supabase } from "../../config/supabase.js";

export const suggestCleaningTool = tool({
  description:
    "Analyze source column profiles and propose a cleaning plan with a ready-to-execute Python script. " +
    "Returns a human-readable plan and a pandas script for execute_cleaning.",
  inputSchema: z.object({
    sourceFileId: z.string().uuid(),
  }),
  execute: async ({ sourceFileId }) => {
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

    const { text } = await generateText({
      model: getModel(),
      messages: [
        {
          role: "system",
          content: `You are a data cleaning expert. Given column profiles with quality flags, propose a cleaning plan.

Analyze each column and decide what transformations are needed. You have FULL FREEDOM — use any pandas/numpy operation.

CRITICAL RULES:
- NEVER use df.dropna() or df = df.dropna(subset=[...]) to handle nulls. This drops rows and causes data loss.
- For nulls: use fillna() with appropriate values (median, mean, mode, 0, "unknown", etc.), interpolation, or flag columns.
- For date parsing: use pd.to_datetime with errors="coerce".
- For type casting: use pd.to_numeric or .astype with error handling.
- Preserve ALL rows unless there are true duplicates.

Return a JSON object:
{
  "plan": [
    { "column": "col_name", "issue": "description of the issue", "fix": "what will be done", "impact": "expected result" }
  ],
  "script": "Python pandas/numpy code that transforms df in place. Use log_step(step_num, col, action, len(df), len(df)) to report each step.",
  "summary": "Brief overall explanation"
}

The script has access to: df (DataFrame), pd, np, json, log_step(step_num, column, action, rows_before, rows_after, warn="").
Do NOT import anything or read/write files — that is handled by the framework.`,
        },
        {
          role: "user",
          content: `Column profiles:\n${JSON.stringify(profileSummary, null, 2)}`,
        },
      ],
      temperature: 0.1,
    });

    const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(jsonStr) as {
      plan: Array<{ column: string; issue: string; fix: string; impact: string }>;
      script: string;
      summary: string;
    };

    return {
      sourceFileId,
      plan: result.plan,
      script: result.script,
      summary: result.summary,
      actionCount: result.plan.length,
    };
  },
});
