import { tool } from "ai";
import { z } from "zod";
import { getModel } from "../../config/ai.js";
import { generateText } from "ai";
import { supabase } from "../../config/supabase.js";

export const suggestCleaningTool = tool({
  description: "Given source profiles with quality flags, propose a structured cleaning plan with specific actions per column. Returns actions list for user review before execution.",
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
      sampleValues: p.sample_values?.slice(0, 3),
      confidence: p.confidence,
    }));

    const { text } = await generateText({
      model: getModel(),
      messages: [
        {
          role: "system",
          content: `You are a data cleaning assistant. Given column profiles with quality flags, propose a structured cleaning plan.

For each column that needs cleaning, output a JSON action:
{
  "column": "column_name",
  "action": "parseDate" | "fillNulls" | "normalizeString" | "castType" | "deduplicateRows" | "convertUnit",
  "params": { ... },
  "reason": "Why this action is needed"
}

Only propose actions for columns that genuinely need cleaning.
Return a JSON object: { "actions": [...], "summary": "Brief explanation" }`,
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
      actions: Array<{ column: string; action: string; params: Record<string, unknown>; reason: string }>;
      summary: string;
    };

    return {
      sourceFileId,
      actions: result.actions,
      summary: result.summary,
      actionCount: result.actions.length,
    };
  },
});
