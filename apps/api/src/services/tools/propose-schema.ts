import { tool } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { getModel } from "../../config/ai.js";
import { supabase } from "../../config/supabase.js";
import { logCorrection } from "../corrections.js";

const FULL_SCHEMA_PROMPT = `You are a data modeling assistant for CareMap, a data harmonization platform.

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

const EXTEND_SCHEMA_PROMPT = `You are a data modeling assistant for CareMap, a data harmonization platform.

An active target schema already exists. A new source file has been added that may introduce data domains not covered by the current schema. Your job is to EXTEND the schema — add new tables and columns where needed, but NEVER remove or modify existing tables or columns.

Rules:
- Keep ALL existing tables and their columns exactly as they are
- Analyze the new source's column profiles to identify data that doesn't fit any existing table
- If the new data represents a new domain (e.g., diagnoses, procedures, assessments), create new tables for it
- If the new data adds columns to an existing domain (e.g., a new field for patients), add columns to the existing table
- Use the same naming conventions as the existing schema (snake_case English)
- Use foreign keys to link new tables to existing ones where relationships exist
- Each new table should have an "id" column
- Provide descriptions for all new tables and columns

Return valid JSON with the COMPLETE schema (existing + new):
{
  "tables": [
    ... all existing tables unchanged ...
    ... new tables added ...
  ],
  "added_tables": ["list of new table names"],
  "added_columns": [{"table": "existing_table", "column": "new_column"}],
  "reasoning": "Brief explanation of what was added and why"
}

If the existing schema already covers the new source adequately, return the existing schema unchanged with empty added_tables and added_columns arrays, and explain why no changes were needed.`;

interface SchemaTable {
  name: string;
  description?: string;
  columns: Array<{ name: string; type: string; description?: string; required?: boolean }>;
}

export const proposeTargetSchemaTool = tool({
  description:
    "Analyze source file profiles and propose a target schema for harmonization. " +
    "In 'full' mode (default), designs a complete schema from scratch. " +
    "In 'extend' mode, loads the current active schema and proposes additions for uncovered data domains — " +
    "existing tables and columns are preserved, only new ones are added.",
  inputSchema: z.object({
    projectId: z.string().uuid(),
    sourceFileIds: z.array(z.string().uuid()),
    mode: z.enum(["full", "extend"]).default("full").describe("'full' for new schema, 'extend' to add to existing"),
    nodeId: z.string().optional().describe("The transform node ID that will own this schema"),
  }),
  execute: async ({ projectId, sourceFileIds, mode, nodeId }) => {
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
          nodeId: nodeId ?? null,
        };
      }

      let systemPrompt = FULL_SCHEMA_PROMPT;
      let userContent = `Source file profiles:\n${JSON.stringify(allProfiles, null, 2)}`;

      if (mode === "extend") {
        let activeSchemaQuery = supabase
          .from("target_schemas")
          .select("tables")
          .eq("project_id", projectId)
          .eq("status", "active")
          .order("version", { ascending: false })
          .limit(1);

        if (nodeId != null) {
          activeSchemaQuery = activeSchemaQuery.eq("node_id", nodeId);
        }

        const { data: activeSchema } = await activeSchemaQuery.maybeSingle();

        if (!activeSchema?.tables) {
          return {
            success: false,
            error: "No active schema found to extend. Use mode='full' to create a new schema.",
            suggestion: "Call propose_target_schema with mode='full' instead.",
            nodeId: nodeId ?? null,
          };
        }

        systemPrompt = EXTEND_SCHEMA_PROMPT;
        userContent =
          `Current active schema:\n${JSON.stringify(activeSchema.tables, null, 2)}\n\n` +
          `New source file profiles:\n${JSON.stringify(allProfiles, null, 2)}`;
      }

      const { text: content } = await generateText({
        model: getModel(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
      });

      if (!content) {
        return {
          success: false,
          error: "Empty response from schema proposal model.",
          retryable: true,
          suggestion: "The model returned an empty response. Try calling propose_target_schema again.",
          nodeId: nodeId ?? null,
        };
      }

      const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
      let result: {
        tables: SchemaTable[];
        added_tables?: string[];
        added_columns?: Array<{ table: string; column: string }>;
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
          nodeId: nodeId ?? null,
        };
      }

      const noChanges = mode === "extend"
        && (!result.added_tables?.length)
        && (!result.added_columns?.length);

      if (noChanges) {
        return {
          success: true,
          schemaId: null,
          version: null,
          status: "no_changes",
          nodeId: nodeId ?? null,
          tableCount: result.tables.length,
          tables: result.tables.map((t) => ({
            name: t.name,
            description: t.description,
            columnCount: t.columns.length,
          })),
          reasoning: result.reasoning ?? "Existing schema already covers the new source data.",
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
          node_id: nodeId ?? null,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: `Failed to save proposed schema: ${error.message}`,
          retryable: false,
          suggestion: "Database write failed. Check project ID and try again.",
          nodeId: nodeId ?? null,
        };
      }

      const actionLabel = "schema_update" as const;
      const addedInfo = mode === "extend"
        ? ` (added tables: ${result.added_tables?.join(", ") ?? "none"}, added columns: ${result.added_columns?.length ?? 0})`
        : "";

      await logCorrection({
        projectId,
        action: actionLabel,
        description: `Proposed target schema v${nextVersion} with ${result.tables.length} tables${addedInfo}: ${result.tables.map((t) => t.name).join(", ")}`,
        newValue: `v${nextVersion}`,
      });

      return {
        success: true,
        schemaId: schema!.id,
        version: nextVersion,
        status: "draft",
        mode,
        nodeId: nodeId ?? null,
        tableCount: result.tables.length,
        tables: result.tables.map((t) => ({
          name: t.name,
          description: t.description,
          columnCount: t.columns.length,
          columns: t.columns,
        })),
        addedTables: result.added_tables ?? [],
        addedColumns: result.added_columns ?? [],
        reasoning: result.reasoning ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        retryable: true,
        suggestion: "An unexpected error occurred. Try calling propose_target_schema again.",
        nodeId: nodeId ?? null,
      };
    }
  },
});
