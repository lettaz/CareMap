import { tool } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "../../config/ai.js";
import { supabase } from "../../config/supabase.js";
import { AIServiceError } from "../../lib/errors.js";

const SCHEMA_PROPOSAL_PROMPT = `You are a data modeling assistant for CareMap, a data harmonization platform.

Given column profiles from multiple source files, design an optimal normalized target schema that captures all the data.

Rules:
- Design a set of relational tables with clear names and columns
- Each table should have an "id" column
- Use foreign keys where relationships exist (e.g., encounter_id linking to encounters)
- Column names should be snake_case English, even if source columns are in another language
- Choose appropriate types: string, integer, float, datetime, boolean, text
- Mark columns as required if they are essential identifiers or keys
- Provide a short description for each table and column explaining its purpose
- Group related data logically (e.g., don't put lab values and medication data in the same table)
- If the data is clinical/medical, use standard healthcare data modeling conventions
- If the data is non-clinical, use domain-appropriate conventions

Return valid JSON:
{
  "tables": [
    {
      "name": "table_name",
      "description": "What this table represents",
      "columns": [
        {"name": "column_name", "type": "string", "description": "What this column stores", "required": true}
      ]
    }
  ],
  "reasoning": "Brief explanation of the design decisions"
}`;

export const proposeTargetSchemaTool = tool({
  description:
    "Analyze all source file profiles and propose an optimal target schema for harmonization. " +
    "This designs the tables and columns that source data will be mapped into.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    sourceFileIds: z.array(z.string().uuid()),
  }),
  execute: async ({ projectId, sourceFileIds }) => {
    try {
      const allProfiles = [];

      for (const sourceFileId of sourceFileIds) {
        const { data: file } = await supabase
          .from("source_files")
          .select("filename")
          .eq("id", sourceFileId)
          .single();

        const { data: profiles } = await supabase
          .from("source_profiles")
          .select()
          .eq("source_file_id", sourceFileId);

        if (!profiles?.length) continue;

        allProfiles.push({
          filename: file?.filename ?? sourceFileId,
          columns: profiles.map((p) => ({
            columnName: p.column_name,
            inferredType: p.inferred_type,
            semanticLabel: p.semantic_label,
            domain: p.domain,
            sampleValues: (p.sample_values as unknown[])?.slice(0, 3) ?? [],
          })),
        });
      }

      if (allProfiles.length === 0) {
        return {
          success: false,
          error: "No profiled source files found. Profile files before proposing a schema.",
          suggestion: "Upload and profile source files first, then try again.",
        };
      }

      const { text: content } = await generateText({
        model: getModel(),
        messages: [
          { role: "system", content: SCHEMA_PROPOSAL_PROMPT },
          {
            role: "user",
            content: `Source file profiles:\n${JSON.stringify(allProfiles, null, 2)}`,
          },
        ],
        temperature: 0.2,
      });

      if (!content) {
        return {
          success: false,
          error: "Empty response from schema proposal model.",
          retryable: true,
          suggestion: "The model returned an empty response. Try calling propose_target_schema again.",
        };
      }

      const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
      let result: {
        tables: Array<{
          name: string;
          description?: string;
          columns: Array<{ name: string; type: string; description?: string; required?: boolean }>;
        }>;
        reasoning?: string;
      };

      try {
        result = JSON.parse(jsonStr);
      } catch {
        return {
          success: false,
          error: `Model returned invalid JSON: ${jsonStr.slice(0, 200)}`,
          retryable: true,
          suggestion: "The model produced malformed JSON. Try calling propose_target_schema again.",
        };
      }

      const { data: latest } = await supabase
        .from("target_schemas")
        .select("version")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (latest?.version as number ?? 0) + 1;

      const { data: schema, error } = await supabase
        .from("target_schemas")
        .insert({
          project_id: projectId,
          version: nextVersion,
          status: "draft",
          tables: result.tables,
          proposed_by: "ai",
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: `Failed to save proposed schema: ${error.message}`,
          retryable: false,
          suggestion: "Database write failed. Check project ID and try again.",
        };
      }

      return {
        success: true,
        schemaId: schema!.id,
        version: nextVersion,
        status: "draft",
        tableCount: result.tables.length,
        tables: result.tables.map((t) => ({
          name: t.name,
          description: t.description,
          columnCount: t.columns.length,
          columns: t.columns.map((c) => c.name),
        })),
        reasoning: result.reasoning ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        retryable: true,
        suggestion: "An unexpected error occurred. Try calling propose_target_schema again.",
      };
    }
  },
});
