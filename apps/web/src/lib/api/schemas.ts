import { apiFetch } from "./client";

export interface SchemaColumnDTO {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
}

export interface SchemaTableDTO {
  name: string;
  description?: string;
  columns: SchemaColumnDTO[];
}

export interface TargetSchemaDTO {
  id: string;
  project_id: string;
  tables: SchemaTableDTO[];
  status: "draft" | "active" | "archived";
  proposed_by: "ai" | "user";
  version: number;
  created_at: string;
  updated_at: string;
}

export function fetchActiveSchema(projectId: string): Promise<TargetSchemaDTO | null> {
  return apiFetch<TargetSchemaDTO | null>(`/api/projects/${projectId}/schema`);
}

export function fetchAllSchemas(projectId: string): Promise<TargetSchemaDTO[]> {
  return apiFetch<TargetSchemaDTO[]>(`/api/projects/${projectId}/schemas`);
}

export function createSchema(
  projectId: string,
  tables: SchemaTableDTO[],
  proposedBy: "ai" | "user" = "user",
): Promise<TargetSchemaDTO> {
  return apiFetch<TargetSchemaDTO>(`/api/projects/${projectId}/schema`, {
    method: "POST",
    body: JSON.stringify({ tables, proposedBy }),
  });
}

export function updateSchema(
  projectId: string,
  schemaId: string,
  patch: { tables?: SchemaTableDTO[]; status?: "draft" | "active" | "archived" },
): Promise<TargetSchemaDTO> {
  return apiFetch<TargetSchemaDTO>(`/api/projects/${projectId}/schema/${schemaId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function activateSchema(
  projectId: string,
  schemaId: string,
): Promise<TargetSchemaDTO> {
  return apiFetch<TargetSchemaDTO>(`/api/projects/${projectId}/schema/${schemaId}/activate`, {
    method: "POST",
  });
}

export function clearSchemaAndMappings(projectId: string): Promise<{ cleared: boolean }> {
  return apiFetch<{ cleared: boolean }>(`/api/projects/${projectId}/schema`, {
    method: "DELETE",
  });
}
