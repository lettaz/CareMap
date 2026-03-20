import { apiFetch } from "./client";
import type { MappingStatus } from "@/lib/types";

export interface FieldMappingDTO {
  id: string;
  source_file_id: string;
  source_column: string;
  target_table: string;
  target_column: string;
  confidence: number;
  transformation: string | null;
  reasoning: string;
  status: MappingStatus;
  sample_value: string | null;
}

export function fetchMappings(projectId: string): Promise<FieldMappingDTO[]> {
  return apiFetch<FieldMappingDTO[]>(`/api/mappings?projectId=${projectId}`);
}

export function updateMapping(
  id: string,
  patch: {
    status?: MappingStatus;
    targetTable?: string;
    targetColumn?: string;
    transformation?: string | null;
  },
): Promise<FieldMappingDTO> {
  return apiFetch<FieldMappingDTO>(`/api/mappings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function bulkAcceptMappings(
  projectId: string,
  threshold = 0.85,
): Promise<{ accepted: number }> {
  return apiFetch<{ accepted: number }>(`/api/mappings/bulk-accept?projectId=${projectId}`, {
    method: "POST",
    body: JSON.stringify({ threshold }),
  });
}

export function generateMappings(
  projectId: string,
  sourceNodeIds: string[],
): Promise<FieldMappingDTO[]> {
  return apiFetch<FieldMappingDTO[]>(`/api/mappings/generate?projectId=${projectId}`, {
    method: "POST",
    body: JSON.stringify({ sourceNodeIds }),
  });
}
