import type { FastifyPluginAsync } from "fastify";
import { supabase } from "../config/supabase.js";
import { getAlertsByProject, acknowledgeAlert } from "../services/quality.js";
import { ValidationError } from "../lib/errors.js";
import type { DashboardResponse } from "../lib/types/api.js";

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { projectId: string } }>("/", async (request) => {
    const { projectId } = request.query;
    if (!projectId) throw new ValidationError("projectId is required");

    const [widgets, alerts, sources] = await Promise.all([
      fetchWidgets(projectId),
      getAlertsByProject(projectId),
      fetchSourceSummaries(projectId),
    ]);

    const response: DashboardResponse = {
      widgets: widgets.map((w) => ({
        id: w.id,
        title: w.title,
        queryText: w.query_text,
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
      })),
      sources,
    };

    return response;
  });

  app.post<{ Querystring: { projectId: string } }>("/widgets", async (request, reply) => {
    const { projectId } = request.query;
    if (!projectId) throw new ValidationError("projectId is required");

    const body = request.body as {
      title: string;
      queryText: string;
      sqlQuery: string;
      chartSpec: Record<string, unknown>;
    };

    const { data, error } = await supabase
      .from("pinned_widgets")
      .insert({
        project_id: projectId,
        title: body.title,
        query_text: body.queryText,
        sql_query: body.sqlQuery,
        chart_spec: body.chartSpec,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to pin widget: ${error.message}`);
    return reply.status(201).send(data);
  });

  app.delete<{ Params: { widgetId: string } }>("/widgets/:widgetId", async (request, reply) => {
    const { widgetId } = request.params;
    await supabase.from("pinned_widgets").delete().eq("id", widgetId);
    return reply.status(204).send();
  });

  app.patch<{ Params: { alertId: string } }>("/alerts/:alertId/acknowledge", async (request) => {
    const { alertId } = request.params;
    await acknowledgeAlert(alertId);
    return { acknowledged: true };
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
    .select("id, filename, row_count")
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
      mappedFields: acceptedMappings ?? 0,
      unmappedFields: (totalMappings ?? 0) - (acceptedMappings ?? 0),
    });
  }

  return summaries;
}
