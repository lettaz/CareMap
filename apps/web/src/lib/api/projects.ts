import { apiFetch } from "./client";

export interface ProjectDTO {
  id: string;
  name: string;
  description: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SourceFileDTO {
  id: string;
  filename: string;
  file_type: string;
  row_count: number;
  column_count: number;
  status: string;
  storage_path: string;
  uploaded_at: string;
}

export function fetchProjects(): Promise<ProjectDTO[]> {
  return apiFetch<ProjectDTO[]>("/api/projects");
}

export function fetchProject(id: string): Promise<ProjectDTO> {
  return apiFetch<ProjectDTO>(`/api/projects/${id}`);
}

export function createProject(
  name: string,
  description?: string,
): Promise<ProjectDTO> {
  return apiFetch<ProjectDTO>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export function updateProject(
  id: string,
  patch: { name?: string; description?: string | null; settings?: Record<string, unknown> },
): Promise<ProjectDTO> {
  return apiFetch<ProjectDTO>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/api/projects/${id}`, { method: "DELETE" });
}

export function fetchProjectSources(projectId: string): Promise<SourceFileDTO[]> {
  return apiFetch<SourceFileDTO[]>(`/api/projects/${projectId}/sources`);
}
