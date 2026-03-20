import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { supabase } from "../config/supabase.js";
import { getAlertsByProject, acknowledgeAlert, runManualQualityCheck } from "../services/quality.js";
import { ValidationError } from "../lib/errors.js";

const pinArtifactSchema = z.object({
  title: z.string().min(1),
  queryText: z.string(),
  queryCode: z.string(),
  chartSpec: z.record(z.unknown()),
});

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { projectId: string } }>("/", async (request) => {
    const { projectId } = request.query;
    if (!projectId) throw new ValidationError("projectId is required");

    const [widgets, alerts, sources, completeness, lineage, corrections] = await Promise.all([
      fetchWidgets(projectId),
      getAlertsByProject(projectId),
      fetchSourceSummaries(projectId),
      fetchCompleteness(projectId),
      fetchLineage(projectId),
      fetchCorrections(projectId),
    ]);

    return {
      widgets: widgets.map((w) => ({
        id: w.id,
        title: w.title,
        queryText: w.query_text,
        queryCode: w.query_code ?? "",
        chartSpec: w.chart_spec as Record<string, unknown>,
        pinnedAt: w.pinned_at,
      })),
      alerts: alerts.map((a) => ({
        id: a.id,
        severity: a.severity,
        summary: a.summary,
        affectedCount: a.affected_count,
        acknowledged: a.acknowledged,
        createdAt: a.created_at,
        sourceFileId: a.source_file_id,
        detectionMethod: a.detection_method,
      })),
      sources,
      completeness,
      lineage,
      corrections,
    };
  });

  app.post<{ Querystring: { projectId: string } }>("/artifacts/pin", async (request, reply) => {
    const { projectId } = request.query;
    if (!projectId) throw new ValidationError("projectId is required");

    const parsed = pinArtifactSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid artifact");

    const { data, error } = await supabase
      .from("pinned_widgets")
      .insert({
        project_id: projectId,
        title: parsed.data.title,
        query_text: parsed.data.queryText,
        query_code: parsed.data.queryCode,
        chart_spec: parsed.data.chartSpec,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to pin artifact: ${error.message}`);
    return reply.status(201).send(data);
  });

  app.delete<{ Params: { widgetId: string } }>("/artifacts/:widgetId", async (request, reply) => {
    const { widgetId } = request.params;
    await supabase.from("pinned_widgets").delete().eq("id", widgetId);
    return reply.status(204).send();
  });

  app.patch<{ Params: { alertId: string } }>("/alerts/:alertId/acknowledge", async (request) => {
    const { alertId } = request.params;
    await acknowledgeAlert(alertId);
    return { acknowledged: true };
  });

  app.post<{ Querystring: { projectId: string } }>("/quality-check", async (request) => {
    const { projectId } = request.query;
    if (!projectId) throw new ValidationError("projectId is required");

    const alerts = await runManualQualityCheck(projectId);
    return {
      persisted: alerts.length,
      alerts: alerts.map((a) => ({
        id: a.id,
        severity: a.severity,
        summary: a.summary,
        affectedCount: a.affected_count,
        acknowledged: a.acknowledged,
        createdAt: a.created_at,
        sourceFileId: a.source_file_id,
        detectionMethod: a.detection_method,
      })),
    };
  });
};

async function fetchWidgets(projectId: string) {
  const { data, error } = await supabase
    .from("pinned_widgets")
    .select()
    .eq("project_id", projectId)
    .order("pinned_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch widgets: ${error.message}`);
  return data ?? [];
}

async function fetchSourceSummaries(projectId: string) {
  const { data: files, error } = await supabase
    .from("source_files")
    .select("id, filename, row_count, status")
    .eq("project_id", projectId);

  if (error) throw new Error(`Failed to fetch sources: ${error.message}`);

  const summaries = [];
  for (const file of files ?? []) {
    const { count: totalMappings } = await supabase
      .from("field_mappings")
      .select("*", { count: "exact", head: true })
      .eq("source_file_id", file.id);

    const { count: acceptedMappings } = await supabase
      .from("field_mappings")
      .select("*", { count: "exact", head: true })
      .eq("source_file_id", file.id)
      .eq("status", "accepted");

    summaries.push({
      id: file.id,
      filename: file.filename,
      rowCount: file.row_count ?? 0,
      status: (file as Record<string, unknown>).status as string ?? "raw",
      mappedFields: acceptedMappings ?? 0,
      unmappedFields: (totalMappings ?? 0) - (acceptedMappings ?? 0),
    });
  }

  return summaries;
}

async function fetchCompleteness(projectId: string) {
  const { data: files } = await supabase
    .from("source_files")
    .select("id, filename, row_count, raw_profile")
    .eq("project_id", projectId);

  if (!files?.length) return null;

  type RawStat = { columnName?: string; nullRate?: number };
  type RawProfile = { columns?: RawStat[] };

  const fileMap = new Map(files.map((f) => [f.id, f.filename.replace(/\.[^.]+$/, "")]));
  const buckets = [...new Set(files.map((f) => fileMap.get(f.id)!))];

  const columnNullRates = new Map<string, Map<string, number>>();

  for (const file of files) {
    const raw = file.raw_profile as RawProfile | null;
    const stats = raw?.columns ?? [];
    const bucketName = fileMap.get(file.id)!;

    for (const stat of stats) {
      if (!stat.columnName) continue;
      if (!columnNullRates.has(stat.columnName)) {
        columnNullRates.set(stat.columnName, new Map());
      }
      const fillRate = Math.round((1 - (stat.nullRate ?? 0)) * 100);
      columnNullRates.get(stat.columnName)!.set(bucketName, fillRate);
    }
  }

  if (columnNullRates.size === 0) {
    const { data: profiles } = await supabase
      .from("source_profiles")
      .select("source_file_id, column_name, quality_flags, confidence")
      .in("source_file_id", files.map((f) => f.id));

    if (!profiles?.length) return null;

    for (const profile of profiles) {
      const bucketName = fileMap.get(profile.source_file_id)!;
      if (!columnNullRates.has(profile.column_name)) {
        columnNullRates.set(profile.column_name, new Map());
      }
      const flags = (profile.quality_flags as string[]) ?? [];
      const fillRate = flags.includes("high_null_rate")
        ? Math.round(profile.confidence * 60)
        : Math.round(profile.confidence * 100);
      columnNullRates.get(profile.column_name)!.set(bucketName, Math.min(fillRate, 100));
    }
  }

  const allColumns = [...columnNullRates.keys()];
  const topFields = allColumns.slice(0, 15);

  const values: Record<string, Record<string, number>> = {};
  for (const field of topFields) {
    values[field] = {};
    const rates = columnNullRates.get(field)!;
    for (const bucket of buckets) {
      values[field][bucket] = rates.get(bucket) ?? 0;
    }
  }

  return { fields: topFields, buckets, values };
}

async function fetchLineage(projectId: string) {
  const { data: mappings } = await supabase
    .from("field_mappings")
    .select("source_file_id, source_column, target_table, target_column, transformation, status")
    .eq("project_id", projectId)
    .eq("status", "accepted")
    .limit(100);

  if (!mappings?.length) return [];

  const targetTables = [...new Set(mappings.map((m) => m.target_table))];

  return targetTables.map((table) => {
    const tableMappings = mappings.filter((m) => m.target_table === table);
    return tableMappings.map((m) => ({
      metricLabel: table,
      sourceFileId: m.source_file_id,
      sourceColumn: m.source_column,
      transformations: m.transformation ? [m.transformation] : [],
      targetField: m.target_column,
    }));
  }).flat();
}

async function fetchCorrections(projectId: string) {
  try {
    const { data, error } = await supabase
      .from("corrections_log")
      .select()
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return [];
    return (data ?? []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      timestamp: c.created_at as string,
      action: c.action as string,
      description: c.description as string,
      sourceFileId: c.source_file_id as string | undefined,
      field: c.field as string | undefined,
      previousValue: c.previous_value as string | undefined,
      newValue: c.new_value as string | undefined,
      appliedBy: c.applied_by as string,
    }));
  } catch {
    return [];
  }
}
