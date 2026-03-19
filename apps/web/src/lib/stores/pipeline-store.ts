import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import type {
  PipelineNode,
  PipelineEdge,
  PipelineNodeData,
} from "@/lib/types";

export interface PipelineData {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  selectedNodeId: string | null;
}

const EMPTY_PIPELINE: PipelineData = { nodes: [], edges: [], selectedNodeId: null };

const DEMO_NODES: PipelineNode[] = [
  {
    id: "source-1",
    type: "source",
    position: { x: 80, y: 80 },
    data: {
      category: "source",
      status: "ready",
      label: "Care Assessments",
      rowCount: 247,
      columnCount: 12,
      fileType: "csv",
      domain: "care_assessments",
      description: "CSV source · care assessments domain with mobility, fall risk, and nutrition scores",
    },
  },
  {
    id: "source-2",
    type: "source",
    position: { x: 80, y: 320 },
    data: {
      category: "source",
      status: "warning",
      label: "Lab Results",
      rowCount: 512,
      columnCount: 8,
      fileType: "xlsx",
      domain: "lab_results",
      description: "Excel source · laboratory parameters including CRP, creatinine, and hemoglobin",
      issueCount: 3,
    },
  },
  {
    id: "mapping-1",
    type: "transform",
    position: { x: 440, y: 180 },
    data: {
      category: "transform",
      status: "ready",
      label: "Field Mapping",
      sourceCount: 2,
      mappedCount: 16,
      totalFields: 20,
      columnCount: 20,
      confidenceAvg: 87,
      description: "Aligning 2 sources to canonical clinical data model",
    },
  },
  {
    id: "quality-1",
    type: "quality",
    position: { x: 800, y: 180 },
    data: {
      category: "quality",
      status: "warning",
      label: "Quality Check",
      rowCount: 759,
      checksPass: 8,
      checksWarn: 3,
      checksFail: 1,
      issueCount: 1,
      description: "Validated 759 rows across 12 integrity and range checks",
    },
  },
  {
    id: "store-1",
    type: "sink",
    position: { x: 1160, y: 180 },
    data: {
      category: "sink",
      status: "ready",
      label: "Harmonized Store",
      rowCount: 742,
      targetTable: "canonical",
      lastSyncAt: "2026-03-14T11:30:00Z",
      description: "Writing validated data to canonical Supabase tables",
    },
  },
];

const DEMO_EDGES: PipelineEdge[] = [
  { id: "e-source-1-mapping-1", source: "source-1", target: "mapping-1", animated: true },
  { id: "e-source-2-mapping-1", source: "source-2", target: "mapping-1", animated: true },
  { id: "e-mapping-1-quality-1", source: "mapping-1", target: "quality-1", animated: true },
  { id: "e-quality-1-store-1", source: "quality-1", target: "store-1", animated: true },
];

interface PipelineState {
  pipelines: Record<string, PipelineData>;
  ensurePipeline: (projectId: string) => void;
  setNodes: (projectId: string, nodes: PipelineNode[]) => void;
  setEdges: (projectId: string, edges: PipelineEdge[]) => void;
  onNodesChange: (projectId: string, changes: NodeChange<PipelineNode>[]) => void;
  onEdgesChange: (projectId: string, changes: EdgeChange<PipelineEdge>[]) => void;
  selectNode: (projectId: string, id: string | null) => void;
  addNode: (projectId: string, node: PipelineNode) => void;
  addEdge: (projectId: string, edge: PipelineEdge) => void;
  updateNodeData: (projectId: string, nodeId: string, partial: Partial<PipelineNodeData>) => void;
  removeNode: (projectId: string, nodeId: string) => void;
}

function getPipeline(state: PipelineState, projectId: string): PipelineData {
  return state.pipelines[projectId] ?? EMPTY_PIPELINE;
}

export const usePipelineStore = create<PipelineState>()((set) => ({
  pipelines: {
    "proj-001": { nodes: DEMO_NODES, edges: DEMO_EDGES, selectedNodeId: null },
    "proj-002": { ...EMPTY_PIPELINE },
  },

  ensurePipeline: (projectId) =>
    set((state) => {
      if (state.pipelines[projectId]) return state;
      return { pipelines: { ...state.pipelines, [projectId]: { ...EMPTY_PIPELINE } } };
    }),

  setNodes: (projectId, nodes) =>
    set((state) => ({
      pipelines: { ...state.pipelines, [projectId]: { ...getPipeline(state, projectId), nodes } },
    })),

  setEdges: (projectId, edges) =>
    set((state) => ({
      pipelines: { ...state.pipelines, [projectId]: { ...getPipeline(state, projectId), edges } },
    })),

  onNodesChange: (projectId, changes) =>
    set((state) => {
      const p = getPipeline(state, projectId);
      return { pipelines: { ...state.pipelines, [projectId]: { ...p, nodes: applyNodeChanges(changes, p.nodes) } } };
    }),

  onEdgesChange: (projectId, changes) =>
    set((state) => {
      const p = getPipeline(state, projectId);
      return { pipelines: { ...state.pipelines, [projectId]: { ...p, edges: applyEdgeChanges(changes, p.edges) } } };
    }),

  selectNode: (projectId, id) =>
    set((state) => ({
      pipelines: { ...state.pipelines, [projectId]: { ...getPipeline(state, projectId), selectedNodeId: id } },
    })),

  addNode: (projectId, node) =>
    set((state) => {
      const p = getPipeline(state, projectId);
      return { pipelines: { ...state.pipelines, [projectId]: { ...p, nodes: [...p.nodes, node] } } };
    }),

  addEdge: (projectId, edge) =>
    set((state) => {
      const p = getPipeline(state, projectId);
      return { pipelines: { ...state.pipelines, [projectId]: { ...p, edges: [...p.edges, edge] } } };
    }),

  updateNodeData: (projectId, nodeId, partial) =>
    set((state) => {
      const p = getPipeline(state, projectId);
      return {
        pipelines: {
          ...state.pipelines,
          [projectId]: {
            ...p,
            nodes: p.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...partial } } : n)),
          },
        },
      };
    }),

  removeNode: (projectId, nodeId) =>
    set((state) => {
      const p = getPipeline(state, projectId);
      return {
        pipelines: {
          ...state.pipelines,
          [projectId]: {
            ...p,
            nodes: p.nodes.filter((n) => n.id !== nodeId),
            edges: p.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
            selectedNodeId: p.selectedNodeId === nodeId ? null : p.selectedNodeId,
          },
        },
      };
    }),
}));
