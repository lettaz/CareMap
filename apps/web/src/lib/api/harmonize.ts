import { apiFetch } from "./client";

export interface HarmonizedTableDTO {
  name: string;
  rows: number;
  columns: string[];
}

export interface TablePreviewDTO {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  previewRows: number;
  offset: number;
}

export function fetchHarmonizedTables(
  projectId: string,
  nodeId?: string,
): Promise<{ tables: HarmonizedTableDTO[] }> {
  const params = new URLSearchParams({ projectId });
  if (nodeId) params.set("nodeId", nodeId);
  return apiFetch<{ tables: HarmonizedTableDTO[] }>(
    `/api/harmonize/tables?${params}`,
  );
}

export function fetchTablePreview(
  projectId: string,
  tableName: string,
  limit = 50,
  offset = 0,
  nodeId?: string,
): Promise<TablePreviewDTO> {
  const params = new URLSearchParams({ projectId, limit: String(limit), offset: String(offset) });
  if (nodeId) params.set("nodeId", nodeId);
  return apiFetch<TablePreviewDTO>(
    `/api/harmonize/tables/${tableName}/preview?${params}`,
  );
}

export interface TableJoinDTO {
  fromTable: string;
  toTable: string;
  joinColumn: string;
}

export function fetchTableRelationships(
  projectId: string,
  nodeId?: string,
): Promise<{ joins: TableJoinDTO[] }> {
  const params = new URLSearchParams({ projectId });
  if (nodeId) params.set("nodeId", nodeId);
  return apiFetch<{ joins: TableJoinDTO[] }>(
    `/api/harmonize/relationships?${params}`,
  );
}
