import type { Project } from "../types";

export const MOCK_PROJECTS: Project[] = [
  {
    id: "proj-001",
    name: "Care Assessment Harmonisation",
    description:
      "Harmonise care assessment data from CSV sources into the canonical schema. Covers fall risk, mobility, nutrition, pain, and pressure ulcer scores across 5 wards.",
    createdAt: "2026-03-14T09:00:00Z",
    updatedAt: "2026-03-16T14:30:00Z",
  },
  {
    id: "proj-002",
    name: "Lab Results Integration",
    description:
      "Integrate lab results from XLSX sources with patient records. Links haemoglobin, creatinine, and CRP values to encounters.",
    createdAt: "2026-03-15T11:00:00Z",
    updatedAt: "2026-03-15T11:00:00Z",
  },
];
