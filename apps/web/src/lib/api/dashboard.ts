import { apiFetch } from "./client";
import type { ChartSpec, CompletenessData, LineageEntry, CorrectionEntry } from "@/lib/types";

export interface DashboardWidgetDTO {
  id: string;
  title: string;
  queryText: string;
  queryCode: string;
  chartSpec: ChartSpec;
  pinnedAt: string;
}

export interface DashboardAlertDTO {
  id: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  affectedCount: number;
  acknowledged: boolean;
  createdAt: string;
  sourceFileId?: string | null;
  detectionMethod?: string | null;
}

export interface DashboardSourceDTO {
  id: string;
  filename: string;
  rowCount: number;
  status: string;
  mappedFields: number;
  unmappedFields: number;
}

export interface DashboardDTO {
  widgets: DashboardWidgetDTO[];
  alerts: DashboardAlertDTO[];
  sources: DashboardSourceDTO[];
  completeness: CompletenessData | null;
  lineage: LineageEntry[];
  corrections: CorrectionEntry[];
}

export function fetchDashboard(projectId: string): Promise<DashboardDTO> {
  return apiFetch<DashboardDTO>(`/api/dashboard?projectId=${projectId}`);
}

export function pinWidget(
  projectId: string,
  widget: {
    title: string;
    queryText: string;
    queryCode: string;
    chartSpec: Record<string, unknown>;
  },
): Promise<DashboardWidgetDTO> {
  return apiFetch<DashboardWidgetDTO>(`/api/dashboard/artifacts/pin?projectId=${projectId}`, {
    method: "POST",
    body: JSON.stringify(widget),
  });
}

export function unpinWidget(widgetId: string): Promise<void> {
  return apiFetch<void>(`/api/dashboard/artifacts/${widgetId}`, {
    method: "DELETE",
  });
}

export function acknowledgeAlert(alertId: string): Promise<{ acknowledged: boolean }> {
  return apiFetch<{ acknowledged: boolean }>(
    `/api/dashboard/alerts/${alertId}/acknowledge`,
    { method: "PATCH" },
  );
}

export function runQualityCheck(projectId: string): Promise<{
  persisted: number;
  alerts: DashboardAlertDTO[];
}> {
  return apiFetch(`/api/dashboard/quality-check?projectId=${projectId}`, {
    method: "POST",
  });
}
