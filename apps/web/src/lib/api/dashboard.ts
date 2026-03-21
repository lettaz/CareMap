import { apiFetch } from "./client";
import type { ChartSpec, CompletenessData, LineageEntry, CorrectionEntry } from "@/lib/types";
import type { PaginatedResponse } from "@/lib/types/pagination";

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
  fileType: string;
  rowCount: number;
  columnCount: number;
  status: string;
  domain: string;
  mappedFields: number;
  unmappedFields: number;
  lastSyncAt: string;
  uploadedAt: string;
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

export function fetchAlertsPaginated(
  projectId: string,
  pagination: { page: number; pageSize: number },
): Promise<PaginatedResponse<DashboardAlertDTO>> {
  const params = new URLSearchParams({
    projectId,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  });
  return apiFetch<PaginatedResponse<DashboardAlertDTO>>(`/api/dashboard/alerts?${params}`);
}

export function fetchCorrectionsPaginated(
  projectId: string,
  pagination: { page: number; pageSize: number },
): Promise<PaginatedResponse<CorrectionEntry>> {
  const params = new URLSearchParams({
    projectId,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  });
  return apiFetch<PaginatedResponse<CorrectionEntry>>(`/api/dashboard/corrections?${params}`);
}
