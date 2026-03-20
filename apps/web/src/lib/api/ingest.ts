import { apiFetch } from "./client";

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

export function patchProfile(
  profileId: string,
  patch: { semanticLabel?: string; inferredType?: string },
): Promise<ColumnProfileDTO> {
  return apiFetch<ColumnProfileDTO>(`/api/ingest/profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
