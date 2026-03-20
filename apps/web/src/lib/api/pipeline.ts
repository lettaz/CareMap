import { apiFetch } from "./client";

export interface PipelineNodeDTO {
  id: string;
  node_type: string;
  label: string;
  config: Record<string, unknown> | null;
  position: { x: number; y: number };
  status: string;
}

export interface PipelineEdgeDTO {
  id: string;
  source_node_id: string;
  target_node_id: string;
}

export interface PipelineGraphDTO {
  nodes: PipelineNodeDTO[];
  edges: PipelineEdgeDTO[];
}

export function loadPipeline(projectId: string): Promise<PipelineGraphDTO> {
  return apiFetch<PipelineGraphDTO>(`/api/projects/${projectId}/pipeline`);
}

export function savePipeline(
  projectId: string,
  graph: {
    nodes: Array<{
      id: string;
      node_type: string;
      label: string;
      config?: Record<string, unknown>;
      position: { x: number; y: number };
      status?: string;
    }>;
    edges: Array<{
      id: string;
      source_node_id: string;
      target_node_id: string;
    }>;
  },
): Promise<{ saved: boolean; nodeCount: number; edgeCount: number }> {
  return apiFetch(`/api/projects/${projectId}/pipeline`, {
    method: "PUT",
    body: JSON.stringify(graph),
  });
}

export type TriggerAction =
  | "upload_complete"
  | "suggest_cleaning_requested"
  | "clean_requested"
  | "sources_connected"
  | "harmonize_requested"
  | "export_requested"
  | "quality_check_requested";

export function triggerPipeline(
  projectId: string,
  nodeId: string,
  action: TriggerAction,
  context?: Record<string, unknown>,
): { url: string; body: string } {
  return {
    url: `/api/projects/${projectId}/pipeline/trigger`,
    body: JSON.stringify({ nodeId, action, context }),
  };
}
