import type { SourceFile } from "../types";

export const MOCK_SOURCES: SourceFile[] = [
  {
    id: "src-001",
    filename: "care_assessments.csv",
    fileType: "csv",
    uploadedAt: "2026-03-14T09:23:00Z",
    rowCount: 247,
    columnCount: 12,
    status: "ready",
    domain: "care_assessments",
  },
  {
    id: "src-002",
    filename: "lab_results.xlsx",
    fileType: "xlsx",
    uploadedAt: "2026-03-14T09:25:00Z",
    rowCount: 247,
    columnCount: 8,
    status: "ready",
    domain: "lab_results",
  },
];
