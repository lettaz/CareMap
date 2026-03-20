import { apiFetch } from "./client";
import type { PaginatedResponse } from "@/lib/types/pagination";

export interface ColumnProfileDTO {
  id: string;
  source_file_id: string;
  column_name: string;
  inferred_type: string;
  semantic_label: string;
  domain: string;
  confidence: number;
  sample_values: unknown[];
  quality_flags: string[];
}

export interface DetailedProfileDTO {
  sourceFileId: string;
  filename: string;
  rowCount: number;
  columnCount: number;
  status: string;
  summary: string;
  columns: Array<{
    columnName: string;
    nativeStats: Record<string, unknown>;
    llmInterpretation: Record<string, unknown>;
  }>;
}

export function fetchProfile(sourceFileId: string): Promise<ColumnProfileDTO[]> {
  return apiFetch<ColumnProfileDTO[]>(`/api/ingest/${sourceFileId}/profile`);
}

export function fetchDetailedProfile(sourceFileId: string): Promise<DetailedProfileDTO> {
  return apiFetch<DetailedProfileDTO>(`/api/ingest/${sourceFileId}/profile/detailed`);
}

export function fetchSampleRows(
  sourceFileId: string,
  pagination?: { page: number; pageSize: number },
): Promise<PaginatedResponse<Record<string, unknown>>> {
  const params = new URLSearchParams();
  if (pagination) {
    params.set("page", String(pagination.page));
    params.set("pageSize", String(pagination.pageSize));
  }
  const qs = params.toString();
  return apiFetch<PaginatedResponse<Record<string, unknown>>>(
    `/api/ingest/${sourceFileId}/sample-rows${qs ? `?${qs}` : ""}`,
  );
}

export function patchProfile(
  profileId: string,
  patch: { semanticLabel?: string; inferredType?: string },
): Promise<ColumnProfileDTO> {
  return apiFetch<ColumnProfileDTO>(`/api/ingest/profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteSourceFile(sourceFileId: string): Promise<void> {
  return apiFetch<void>(`/api/ingest/${sourceFileId}`, { method: "DELETE" });
}
