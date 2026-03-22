import type { NodeCategory } from "@/lib/types";

export interface MentionData {
  id: string;
  label: string;
  category: NodeCategory;
  sourceFileId?: string;
}

export function buildMentionMarkup(m: MentionData): string {
  const ref = m.sourceFileId || m.id;
  const tag = `@[${m.label}](${ref})`;
  const nodeIdNote = `nodeId=${m.id}`;
  switch (m.category) {
    case "transform":
      return `${tag} [transform node, ${nodeIdNote} — can generate schema & field mappings]`;
    case "harmonize":
      return `${tag} [harmonize node, ${nodeIdNote} — can run harmonization on accepted mappings]`;
    case "quality":
      return `${tag} [quality check node, ${nodeIdNote} — can run data quality checks]`;
    case "sink":
      return `${tag} [export/store node, ${nodeIdNote} — can export harmonized data]`;
    default:
      return tag;
  }
}
