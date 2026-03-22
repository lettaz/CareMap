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
): Promise<{ tables: HarmonizedTableDTO[] }> {
  return apiFetch<{ tables: HarmonizedTableDTO[] }>(
    `/api/harmonize/tables?projectId=${projectId}`,
  );
}

export function fetchTablePreview(
  projectId: string,
  tableName: string,
  limit = 50,
  offset = 0,
): Promise<TablePreviewDTO> {
  return apiFetch<TablePreviewDTO>(
    `/api/harmonize/tables/${tableName}/preview?projectId=${projectId}&limit=${limit}&offset=${offset}`,
  );
}
