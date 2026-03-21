import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Connection,
  type NodeMouseHandler,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore, type PendingMention } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { SourceNode } from "./nodes/source-node";
import { MappingNode } from "./nodes/mapping-node";
import { HarmonizeNode } from "./nodes/harmonize-node";
import { QualityNode } from "./nodes/quality-node";
import { StoreNode } from "./nodes/store-node";
import { NodeContextMenu } from "./node-context-menu";
import type { PipelineNodeData } from "@/lib/types";

const nodeTypes = {
  source: SourceNode,
  transform: MappingNode,
  harmonize: HarmonizeNode,
  quality: QualityNode,
  sink: StoreNode,
};

const defaultEdgeOptions = {
  style: { stroke: "#CBD5E1", strokeWidth: 2 },
  type: "smoothstep" as const,
};

const NODE_COLOR_MAP: Record<string, string> = {
  source: "#3B82F6",
  transform: "#059669",
  harmonize: "#0891B2",
  quality: "#D97706",
  sink: "#6366F1",
};

function nodeColor(node: Node): string {
  const category = (node.data as PipelineNodeData)?.category;
  return NODE_COLOR_MAP[category ?? ""] ?? "#94A3B8";
}

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeLabel: string;
}

export function FlowCanvas() {
  const { projectId } = useActiveProject();
  const pipeline = usePipelineStore((s) => projectId ? s.pipelines[projectId] : null);
  const selectedNodeId = pipeline?.selectedNodeId ?? null;
  const { onNodesChange, onEdgesChange, addEdge, selectNode, removeNode } = usePipelineStore();
  const isPanelOpen = useAgentStore((s) => s.isPanelOpen);
  const togglePanel = useAgentStore((s) => s.togglePanel);
  const setNodeContext = useAgentStore((s) => s.setNodeContext);
  const setPendingMessage = useAgentStore((s) => s.setPendingMessage);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const isMobile = useIsMobile();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const triggeredTransformsRef = useRef<Set<string>>(new Set());

  const nodes = (pipeline?.nodes ?? []).map((n) => ({
    ...n,
    selected: n.id === selectedNodeId,
    className: n.id === selectedNodeId ? "ring-2 ring-cm-accent ring-offset-2 rounded-lg" : "",
  }));
  const edges = pipeline?.edges ?? [];

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!projectId) return;
      const newEdge = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        animated: true,
      };
      addEdge(projectId, newEdge);

      const allNodes = pipeline?.nodes ?? [];
      const targetNode = allNodes.find((n) => n.id === connection.target);
      if (targetNode?.data.category !== "transform") return;
      if (targetNode.data.status === "running" || triggeredTransformsRef.current.has(connection.target)) return;

      const allEdges = [...(pipeline?.edges ?? []), newEdge];
      const incomingSourceIds = allEdges
        .filter((e) => e.target === connection.target)
        .map((e) => allNodes.find((n) => n.id === e.source))
        .filter((n) => n?.data.category === "source" && n.data.sourceFileId);

      if (incomingSourceIds.length === 0) return;

      triggeredTransformsRef.current.add(connection.target);
      updateNodeData(projectId, connection.target, { status: "running" });

      const mentions: PendingMention[] = incomingSourceIds.map((n) => ({
        label: n!.data.label,
        id: n!.id,
        sourceFileId: n!.data.sourceFileId as string,
        category: "source" as const,
      }));

      const hasActiveSchema = targetNode.data.schemaStatus === "active";

      setPendingMessage({
        text: hasActiveSchema
          ? "Propose field mappings for the connected sources using the active target schema"
          : "Propose a target schema for the connected sources",
        mentions,
        transformNodeId: connection.target,
      });

      setTimeout(() => triggeredTransformsRef.current.delete(connection.target), 5000);
    },
    [projectId, addEdge, pipeline, updateNodeData, setPendingMessage],
  );

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[1]) => {
      if (!projectId) return;
      onNodesChange(projectId, changes);
    },
    [projectId, onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[1]) => {
      if (!projectId) return;
      onEdgesChange(projectId, changes);
    },
    [projectId, onEdgesChange],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      if (!projectId) return;
      selectNode(projectId, node.id);
      if (!isPanelOpen) togglePanel();
    },
    [projectId, selectNode, isPanelOpen, togglePanel],
  );

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      const nodeData = node.data as PipelineNodeData;
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeLabel: nodeData.label ?? node.id,
      });
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    if (!projectId) return;
    selectNode(projectId, null);
    setContextMenu(null);
  }, [projectId, selectNode]);

  const handleSendToChat = useCallback(
    (nodeId: string, label: string) => {
      if (!projectId) return;
      setNodeContext({ nodeId, label });
      if (!isPanelOpen) togglePanel();
    },
    [projectId, setNodeContext, isPanelOpen, togglePanel],
  );

  const handleRemoveNode = useCallback(
    (nodeId: string) => {
      if (!projectId || !removeNode) return;
      removeNode(projectId, nodeId);
    },
    [projectId, removeNode],
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        className="bg-cm-bg-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#CBD5E1" />
        <Controls className="!border-cm-border-primary !bg-cm-bg-surface !shadow-sm" />
        {!isMobile && (
          <MiniMap
            nodeColor={nodeColor}
            nodeStrokeWidth={2}
            maskColor="rgba(0,0,0,0.08)"
            style={{ width: 140, height: 90 }}
            className="!rounded-lg !border !border-cm-border-primary !bg-cm-bg-surface !shadow-sm"
          />
        )}
      </ReactFlow>

      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          nodeLabel={contextMenu.nodeLabel}
          onClose={() => setContextMenu(null)}
          onSendToChat={handleSendToChat}
          onRemove={handleRemoveNode}
        />
      )}
    </>
  );
}
