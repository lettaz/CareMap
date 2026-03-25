import { apiFetch, apiUrl } from "./client";
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
  cleaningPlan?: {
    plan: Array<{ column: string; issue: string; fix: string; impact: string }>;
    script: string;
    summary: string;
  } | null;
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
  version?: "original" | "cleaned",
): Promise<PaginatedResponse<Record<string, unknown>>> {
  const params = new URLSearchParams();
  if (pagination) {
    params.set("page", String(pagination.page));
    params.set("pageSize", String(pagination.pageSize));
  }
  if (version && version !== "original") {
    params.set("version", version);
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

export interface ExcelSheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
}

export async function peekSheets(file: File): Promise<ExcelSheetInfo[]> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(apiUrl("/api/ingest/peek-sheets"), {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to detect sheets");
  const body = (await res.json()) as { sheets: ExcelSheetInfo[] };
  return body.sheets;
}
