import { supabase } from "../config/supabase.js";
import { downloadFile, manifestPath } from "./storage.js";
import type {
  SemanticEntityRow,
  SemanticFieldRow,
  SemanticJoinRow,
  SourceFileRow,
  FieldMappingRow,
  PipelineNodeRow,
  SourceProfileRow,
} from "../lib/types/database.js";

export interface SemanticContext {
  projectName: string;
  projectDescription: string | null;
  sources: Array<{
    id: string;
    filename: string;
    rowCount: number | null;
    status: string;
    hasCleanedVersion: boolean;
    columns: Array<{
      name: string;
      type: string;
      semanticLabel: string | null;
      domain: string | null;
    }>;
  }>;
  mappings: Array<{
    sourceColumn: string;
    sourceFile: string;
    targetTable: string;
    targetColumn: string;
    status: string;
    confidence: number;
  }>;
  entities: SemanticEntityRow[];
  fields: SemanticFieldRow[];
  joins: SemanticJoinRow[];
  pipelineNodes: PipelineNodeRow[];
  alerts: Array<{ severity: string; summary: string }>;
}

interface ManifestTable {
  name: string;
  rows: number;
  columns: string[];
}

export async function updateSemanticLayer(projectId: string): Promise<void> {
  let manifest: { tables: ManifestTable[] };

  try {
    const buffer = await downloadFile(manifestPath(projectId));
    manifest = JSON.parse(buffer.toString("utf-8")) as { tables: ManifestTable[] };
  } catch {
    return;
  }

  await supabase.from("semantic_fields").delete().in(
    "entity_id",
    (await supabase.from("semantic_entities").select("id").eq("project_id", projectId)).data?.map((e) => e.id) ?? [],
  );
  await supabase.from("semantic_joins").delete().in(
    "from_entity_id",
    (await supabase.from("semantic_entities").select("id").eq("project_id", projectId)).data?.map((e) => e.id) ?? [],
  );
  await supabase.from("semantic_entities").delete().eq("project_id", projectId);

  for (const table of manifest.tables) {
    const { data: entity } = await supabase
      .from("semantic_entities")
      .insert({
        project_id: projectId,
        entity_name: table.name,
        description: `Harmonized ${table.name} table with ${table.rows} rows`,
        parquet_path: `harmonized/${projectId}/${table.name}.csv`,
        row_count: table.rows,
        created_from: [],
      })
      .select()
      .single();

    if (!entity) continue;

    const fieldInserts = table.columns.map((col) => ({
      entity_id: entity.id,
      field_name: col,
      data_type: "unknown",
      description: null,
    }));

    if (fieldInserts.length > 0) {
      await supabase.from("semantic_fields").insert(fieldInserts);
    }
  }

  const { data: entities } = await supabase
    .from("semantic_entities")
    .select("id, entity_name")
    .eq("project_id", projectId);

  if (entities && entities.length > 1) {
    const { data: allFields } = await supabase
      .from("semantic_fields")
      .select("entity_id, field_name")
      .in("entity_id", entities.map((e) => e.id));

    if (allFields) {
      const fieldsByName = new Map<string, string[]>();
      for (const f of allFields) {
        const existing = fieldsByName.get(f.field_name) ?? [];
        existing.push(f.entity_id);
        fieldsByName.set(f.field_name, existing);
      }

      const joinInserts: Array<{ from_entity_id: string; to_entity_id: string; join_column: string }> = [];
      for (const [col, entityIds] of fieldsByName) {
        if (entityIds.length < 2) continue;
        for (let i = 0; i < entityIds.length; i++) {
          for (let j = i + 1; j < entityIds.length; j++) {
            joinInserts.push({
              from_entity_id: entityIds[i]!,
              to_entity_id: entityIds[j]!,
              join_column: col,
            });
          }
        }
      }

      if (joinInserts.length > 0) {
        await supabase.from("semantic_joins").insert(joinInserts);
      }
    }
  }
}

export async function getSemanticContext(projectId: string): Promise<SemanticContext> {
  const { data: sourceNodes } = await supabase
    .from("pipeline_nodes")
    .select("config")
    .eq("project_id", projectId)
    .eq("node_type", "source");

  const activeSourceFileIds = new Set(
    (sourceNodes ?? [])
      .map((n) => (n.config as Record<string, unknown>)?.sourceFileId as string | undefined)
      .filter(Boolean) as string[],
  );

  const [
    projectResult,
    sourcesResult,
    profilesResult,
    mappingsResult,
    entitiesResult,
    fieldsResult,
    joinsResult,
    nodesResult,
    alertsResult,
  ] = await Promise.all([
    supabase.from("projects").select().eq("id", projectId).single(),
    supabase.from("source_files").select().eq("project_id", projectId),
    supabase.from("source_profiles").select().in(
      "source_file_id",
      (await supabase.from("source_files").select("id").eq("project_id", projectId)).data?.map((f) => f.id) ?? [],
    ),
    supabase.from("field_mappings").select().eq("project_id", projectId),
    supabase.from("semantic_entities").select().eq("project_id", projectId),
    supabase.from("semantic_fields").select(),
    supabase.from("semantic_joins").select(),
    supabase.from("pipeline_nodes").select().eq("project_id", projectId),
    supabase.from("quality_alerts").select("severity, summary").eq("project_id", projectId).eq("acknowledged", false).limit(10),
  ]);

  const project = projectResult.data;
  const allSources = (sourcesResult.data ?? []) as SourceFileRow[];
  const sources = activeSourceFileIds.size > 0
    ? allSources.filter((s) => activeSourceFileIds.has(s.id))
    : allSources;
  const profiles = (profilesResult.data ?? []) as SourceProfileRow[];
  const mappings = (mappingsResult.data ?? []) as FieldMappingRow[];
  const entities = (entitiesResult.data ?? []) as SemanticEntityRow[];
  const entityIds = entities.map((e) => e.id);
  const fields = ((fieldsResult.data ?? []) as SemanticFieldRow[]).filter((f) => entityIds.includes(f.entity_id));
  const joins = ((joinsResult.data ?? []) as SemanticJoinRow[]).filter(
    (j) => entityIds.includes(j.from_entity_id) || entityIds.includes(j.to_entity_id),
  );
  const nodes = (nodesResult.data ?? []) as PipelineNodeRow[];
  const alerts = (alertsResult.data ?? []) as Array<{ severity: string; summary: string }>;

  return {
    projectName: project?.name ?? "",
    projectDescription: project?.description ?? null,
    sources: sources.map((s) => ({
      id: s.id,
      filename: s.filename,
      rowCount: s.row_count,
      status: s.status,
      hasCleanedVersion: !!s.cleaned_path,
      columns: profiles
        .filter((p) => p.source_file_id === s.id)
        .map((p) => ({
          name: p.column_name,
          type: p.inferred_type,
          semanticLabel: p.semantic_label,
          domain: p.domain,
        })),
    })),
    mappings: mappings.map((m) => {
      const source = sources.find((s) => s.id === m.source_file_id);
      return {
        sourceColumn: m.source_column,
        sourceFile: source?.filename ?? m.source_file_id,
        targetTable: m.target_table,
        targetColumn: m.target_column,
        status: m.status,
        confidence: m.confidence,
      };
    }),
    entities,
    fields,
    joins,
    pipelineNodes: nodes,
    alerts,
  };
}
