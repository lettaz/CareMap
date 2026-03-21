import { create } from "zustand";
import { toast } from "sonner";
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
  NodeCategory,
} from "@/lib/types";
import {
  loadPipeline as apiLoadPipeline,
  savePipeline as apiSavePipeline,
  type PipelineNodeDTO,
  type PipelineEdgeDTO,
} from "@/lib/api/pipeline";
import { deleteSourceFile } from "@/lib/api/ingest";
import { clearSchemaAndMappings } from "@/lib/api/schemas";
import { useAgentStore } from "./agent-store";

export interface PipelineData {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  selectedNodeId: string | null;
}

const EMPTY_PIPELINE: PipelineData = { nodes: [], edges: [], selectedNodeId: null };

const NODE_TYPE_MAP: Record<string, string> = {
  source: "source",
  mapping: "transform",
  transform: "transform",
  harmonize: "harmonize",
  quality: "quality",
  output: "sink",
  sink: "sink",
};

const CATEGORY_MAP: Record<string, NodeCategory> = {
  source: "source",
  mapping: "transform",
  transform: "transform",
  harmonize: "harmonize",
  quality: "quality",
  output: "sink",
  sink: "sink",
};

function dtoToNode(dto: PipelineNodeDTO): PipelineNode {
  const rfType = NODE_TYPE_MAP[dto.node_type] ?? dto.node_type;
  const category = CATEGORY_MAP[dto.node_type] ?? ("sink" as NodeCategory);
  return {
    id: dto.id,
    type: rfType,
    position: dto.position,
    data: {
      category,
      status: (dto.status as PipelineNodeData["status"]) ?? "idle",
      label: dto.label ?? dto.node_type,
      ...(dto.config as Record<string, unknown> ?? {}),
    },
  };
}

function dtoToEdge(dto: PipelineEdgeDTO): PipelineEdge {
  return {
    id: dto.id,
    source: dto.source_node_id,
    target: dto.target_node_id,
    animated: true,
  };
}

function nodeToSaveDTO(node: PipelineNode) {
  const { category, status, label, ...config } = node.data;
  let nodeType = category as string;
  if (category === "transform") nodeType = "mapping";
  if (category === "sink") nodeType = "output";

  return {
    id: node.id,
    node_type: nodeType,
    label: label ?? node.id,
    config: Object.keys(config).length > 0 ? config : undefined,
    position: node.position,
    status: status ?? "idle",
  };
}

function edgeToSaveDTO(edge: PipelineEdge) {
  return {
    id: edge.id,
    source_node_id: edge.source,
    target_node_id: edge.target,
  };
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SAVE_DEBOUNCE_MS = 800;

function debouncedSave(projectId: string, getData: () => PipelineData) {
  const existing = saveTimers.get(projectId);
  if (existing) clearTimeout(existing);

  saveTimers.set(
    projectId,
    setTimeout(() => {
      const data = getData();
      apiSavePipeline(projectId, {
        nodes: data.nodes.map(nodeToSaveDTO),
        edges: data.edges.map(edgeToSaveDTO),
      }).catch((err) => {
        console.error("Pipeline save failed:", err);
        toast.error("Pipeline save failed", { description: String(err) });
      });
      saveTimers.delete(projectId);
    }, SAVE_DEBOUNCE_MS),
  );
}

interface PipelineState {
  pipelines: Record<string, PipelineData>;
  loading: boolean;
  loadPipeline: (projectId: string) => Promise<void>;
  ensurePipeline: (projectId: string) => void;
  setNodes: (projectId: string, nodes: PipelineNode[]) => void;
  setEdges: (projectId: string, edges: PipelineEdge[]) => void;
  onNodesChange: (projectId: string, changes: NodeChange<PipelineNode>[]) => void;
  onEdgesChange: (projectId: string, changes: EdgeChange<PipelineEdge>[]) => void;
  selectNode: (projectId: string, id: string | null) => void;
  addNode: (projectId: string, node: PipelineNode) => void;
  addEdge: (projectId: string, edge: PipelineEdge) => void;
  updateNodeData: (projectId: string, nodeId: string, partial: Partial<PipelineNodeData>) => void;
  notifySourceReady: (projectId: string, sourceNodeId: string) => void;
  removeNode: (projectId: string, nodeId: string) => void;
}

const NODE_HEIGHT = 160;
const NODE_GAP = 24;
const NODE_STRIDE = NODE_HEIGHT + NODE_GAP;

function fixOverlappingNodes(nodes: PipelineNode[]): PipelineNode[] {
  const byColumn = new Map<number, PipelineNode[]>();

  for (const n of nodes) {
    const col = Math.round(n.position.x / 50) * 50;
    const arr = byColumn.get(col) ?? [];
    arr.push(n);
    byColumn.set(col, arr);
  }

  const result = [...nodes];

  for (const group of byColumn.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.position.y - b.position.y);

    let hasOverlap = false;
    for (let i = 1; i < group.length; i++) {
      if (group[i].position.y - group[i - 1].position.y < NODE_HEIGHT) {
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) continue;

    const startY = group[0].position.y;
    for (let i = 0; i < group.length; i++) {
      const idx = result.findIndex((n) => n.id === group[i].id);
      if (idx === -1) continue;
      result[idx] = {
        ...result[idx],
        position: { x: result[idx].position.x, y: startY + i * NODE_STRIDE },
      };
    }
  }

  return result;
}

function getPipeline(state: PipelineState, projectId: string): PipelineData {
  return state.pipelines[projectId] ?? EMPTY_PIPELINE;
}

export const usePipelineStore = create<PipelineState>()((set, get) => ({
  pipelines: {},
  loading: false,

  loadPipeline: async (projectId) => {
    set({ loading: true });
    try {
      const dto = await apiLoadPipeline(projectId);
      const rawNodes = dto.nodes.map(dtoToNode);
      const nodes = fixOverlappingNodes(rawNodes);
      const edges = dto.edges.map(dtoToEdge);

      const positionsChanged = rawNodes.some((n, i) =>
        n.position.x !== nodes[i].position.x || n.position.y !== nodes[i].position.y,
      );

      set((state) => ({
        loading: false,
        pipelines: {
          ...state.pipelines,
          [projectId]: { nodes, edges, selectedNodeId: null },
        },
      }));

      if (positionsChanged) {
        debouncedSave(projectId, () => getPipeline(get(), projectId));
      }
    } catch {
      set((state) => ({
        loading: false,
        pipelines: {
          ...state.pipelines,
          [projectId]: { ...EMPTY_PIPELINE },
        },
      }));
    }
  },

  ensurePipeline: (projectId) =>
    set((state) => {
      if (state.pipelines[projectId]) return state;
      return { pipelines: { ...state.pipelines, [projectId]: { ...EMPTY_PIPELINE } } };
    }),

  setNodes: (projectId, nodes) => {
    set((state) => ({
      pipelines: { ...state.pipelines, [projectId]: { ...getPipeline(state, projectId), nodes } },
    }));
    debouncedSave(projectId, () => getPipeline(get(), projectId));
  },

  setEdges: (projectId, edges) => {
    set((state) => ({
      pipelines: { ...state.pipelines, [projectId]: { ...getPipeline(state, projectId), edges } },
    }));
    debouncedSave(projectId, () => getPipeline(get(), projectId));
  },

  onNodesChange: (projectId, changes) => {
    const removeChanges = changes.filter((c) => c.type === "remove");
    if (removeChanges.length > 0) {
      const p = getPipeline(get(), projectId);
      for (const change of removeChanges) {
        if (change.type !== "remove") continue;
        const node = p.nodes.find((n) => n.id === change.id);
        const sfId = node?.data.category === "source"
          ? (node.data.sourceFileId as string | undefined)
          : undefined;
        if (sfId) {
          deleteSourceFile(sfId).catch((err) => {
            toast.error("Failed to delete source data", { description: (err as Error).message });
          });
        }
      }
    }

    set((state) => {
      const p = getPipeline(state, projectId);
      return { pipelines: { ...state.pipelines, [projectId]: { ...p, nodes: applyNodeChanges(changes, p.nodes) } } };
    });

    const hasPositionChange = changes.some((c) => c.type === "position" && c.dragging === false);
    const hasRemove = removeChanges.length > 0;
    if (hasPositionChange || hasRemove) {
      debouncedSave(projectId, () => getPipeline(get(), projectId));
    }
  },

  onEdgesChange: (projectId, changes) => {
    const beforePipeline = getPipeline(get(), projectId);
    const removedEdges = changes
      .filter((c) => c.type === "remove")
      .map((c) => beforePipeline.edges.find((e) => e.id === c.id))
      .filter(Boolean) as PipelineEdge[];

    set((state) => {
      const p = getPipeline(state, projectId);
      return { pipelines: { ...state.pipelines, [projectId]: { ...p, edges: applyEdgeChanges(changes, p.edges) } } };
    });
    debouncedSave(projectId, () => getPipeline(get(), projectId));

    if (removedEdges.length === 0) return;

    const updated = getPipeline(get(), projectId);
    const affectedTransformIds = new Set(
      removedEdges
        .map((e) => e.target)
        .filter((targetId) => {
          const node = updated.nodes.find((n) => n.id === targetId);
          return node?.data.category === "transform";
        }),
    );

    for (const transformId of affectedTransformIds) {
      const remainingSources = updated.edges
        .filter((e) => e.target === transformId)
        .map((e) => updated.nodes.find((n) => n.id === e.source))
        .filter((n) => n?.data.category === "source" && n.data.sourceFileId);

      if (remainingSources.length === 0) {
        get().updateNodeData(projectId, transformId, {
          status: "idle",
          schemaStatus: undefined,
          mappedCount: undefined,
          totalFields: undefined,
          confidenceAvg: undefined,
          sourceCount: undefined,
          schemaTableCount: undefined,
        });
        clearSchemaAndMappings(projectId).catch((err) => {
          console.error("Failed to clear schema/mappings:", err);
        });
      } else {
        get().updateNodeData(projectId, transformId, { status: "running" });
        const agentStore = useAgentStore.getState();
        agentStore.openPanel();
        agentStore.setPendingMessage({
          text: "A source was disconnected. Re-propose the target schema for the remaining connected sources",
          mentions: remainingSources.map((n) => ({
            label: n!.data.label,
            id: n!.id,
            sourceFileId: n!.data.sourceFileId as string,
            category: "source" as const,
          })),
          transformNodeId: transformId,
        });
      }

      const downstreamIds = updated.edges
        .filter((e) => e.source === transformId)
        .map((e) => e.target);
      for (const dsId of downstreamIds) {
        if (updated.nodes.find((n) => n.id === dsId)) {
          get().updateNodeData(projectId, dsId, { stale: true });
        }
      }
    }
  },

  selectNode: (projectId, id) =>
    set((state) => ({
      pipelines: { ...state.pipelines, [projectId]: { ...getPipeline(state, projectId), selectedNodeId: id } },
    })),

  addNode: (projectId, node) => {
    set((state) => {
      const p = getPipeline(state, projectId);
      return { pipelines: { ...state.pipelines, [projectId]: { ...p, nodes: [...p.nodes, node] } } };
    });
    debouncedSave(projectId, () => getPipeline(get(), projectId));
  },

  addEdge: (projectId, edge) => {
    set((state) => {
      const p = getPipeline(state, projectId);
      return { pipelines: { ...state.pipelines, [projectId]: { ...p, edges: [...p.edges, edge] } } };
    });
    debouncedSave(projectId, () => getPipeline(get(), projectId));
  },

  updateNodeData: (projectId, nodeId, partial) => {
    const clearStale = partial.status === "ready" || partial.status === "running";
    const merged = clearStale ? { stale: undefined, ...partial } : partial;

    set((state) => {
      const p = getPipeline(state, projectId);
      return {
        pipelines: {
          ...state.pipelines,
          [projectId]: {
            ...p,
            nodes: p.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...merged } } : n)),
          },
        },
      };
    });
    debouncedSave(projectId, () => getPipeline(get(), projectId));
  },

  notifySourceReady: (projectId, sourceNodeId) => {
    const p = getPipeline(get(), projectId);
    const sourceNode = p.nodes.find((n) => n.id === sourceNodeId);
    if (!sourceNode || sourceNode.data.category !== "source" || !sourceNode.data.sourceFileId) return;

    const connectedTransformIds = p.edges
      .filter((e) => e.source === sourceNodeId)
      .map((e) => e.target)
      .filter((targetId) => {
        const target = p.nodes.find((n) => n.id === targetId);
        return target?.data.category === "transform";
      });

    for (const transformId of connectedTransformIds) {
      const transformNode = p.nodes.find((n) => n.id === transformId);
      if (!transformNode || transformNode.data.status === "running") continue;

      const allSources = p.edges
        .filter((e) => e.target === transformId)
        .map((e) => p.nodes.find((n) => n.id === e.source))
        .filter((n) => n?.data.category === "source" && n.data.sourceFileId);

      if (allSources.length === 0) continue;

      const hasActiveSchema = transformNode.data.schemaStatus === "active";

      get().updateNodeData(projectId, transformId, { status: "running" });
      const agentStore = useAgentStore.getState();
      agentStore.openPanel();
      agentStore.setPendingMessage({
        text: hasActiveSchema
          ? "Propose field mappings for the connected sources using the active target schema"
          : "Propose a target schema for the connected sources",
        mentions: allSources.map((n) => ({
          label: n!.data.label,
          id: n!.id,
          sourceFileId: n!.data.sourceFileId as string,
          category: "source" as const,
        })),
        transformNodeId: transformId,
      });
      toast.info("Transform triggered", {
        description: hasActiveSchema
          ? "Source data is ready — field mapping will start"
          : "Source data is ready — schema proposal will start",
      });
    }
  },

  removeNode: (projectId, nodeId) => {
    const p = getPipeline(get(), projectId);
    const node = p.nodes.find((n) => n.id === nodeId);
    const isSource = node?.data.category === "source";
    const sourceFileId = isSource ? (node.data.sourceFileId as string | undefined) : undefined;

    const affectedEdges = p.edges.filter((e) => e.source === nodeId || e.target === nodeId);
    const directTargetIds = affectedEdges
      .filter((e) => e.source === nodeId)
      .map((e) => e.target);

    set((state) => {
      const pipeline = getPipeline(state, projectId);
      return {
        pipelines: {
          ...state.pipelines,
          [projectId]: {
            ...pipeline,
            nodes: pipeline.nodes.filter((n) => n.id !== nodeId),
            edges: pipeline.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
            selectedNodeId: pipeline.selectedNodeId === nodeId ? null : pipeline.selectedNodeId,
          },
        },
      };
    });
    debouncedSave(projectId, () => getPipeline(get(), projectId));

    if (sourceFileId) {
      deleteSourceFile(sourceFileId).catch((err) => {
        toast.error("Failed to delete source data", { description: (err as Error).message });
      });
    }

    if (node?.data.category === "transform") {
      clearSchemaAndMappings(projectId).catch((err) => {
        console.error("Failed to clear schema/mappings:", err);
      });
    }

    if (!isSource) return;

    const updatedPipeline = getPipeline(get(), projectId);

    for (const targetId of directTargetIds) {
      const targetNode = updatedPipeline.nodes.find((n) => n.id === targetId);
      if (!targetNode) continue;

      if (targetNode.data.category === "transform") {
        const remainingSources = updatedPipeline.edges
          .filter((e) => e.target === targetId)
          .map((e) => updatedPipeline.nodes.find((n) => n.id === e.source))
          .filter((n) => n?.data.category === "source" && n.data.sourceFileId);

        if (remainingSources.length > 0) {
          get().updateNodeData(projectId, targetId, { status: "running" });
          const agentStore = useAgentStore.getState();
          agentStore.openPanel();
          agentStore.setPendingMessage({
            text: "A source was removed. Re-propose the target schema for the remaining connected sources",
            mentions: remainingSources.map((n) => ({
              label: n!.data.label,
              id: n!.id,
              sourceFileId: n!.data.sourceFileId as string,
              category: "source" as const,
            })),
            transformNodeId: targetId,
          });
          toast.info("Re-mapping triggered", { description: "Transform node will update with remaining sources" });
        } else {
          get().updateNodeData(projectId, targetId, {
            status: "idle",
            schemaStatus: undefined,
            mappedCount: undefined,
            totalFields: undefined,
            confidenceAvg: undefined,
            sourceCount: undefined,
            schemaTableCount: undefined,
          });
          clearSchemaAndMappings(projectId).catch((err) => {
            console.error("Failed to clear schema/mappings:", err);
          });
          toast.info("Transform node reset", { description: "No sources connected" });
        }

        const downstreamIds = updatedPipeline.edges
          .filter((e) => e.source === targetId)
          .map((e) => e.target);

        for (const dsId of downstreamIds) {
          const dsNode = updatedPipeline.nodes.find((n) => n.id === dsId);
          if (!dsNode) continue;
          get().updateNodeData(projectId, dsId, { stale: true });
        }
      } else {
        get().updateNodeData(projectId, targetId, { stale: true });
      }
    }
  },
}));
