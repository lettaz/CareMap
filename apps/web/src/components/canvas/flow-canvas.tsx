import { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Connection,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { SourceNode } from "./nodes/source-node";
import { MappingNode } from "./nodes/mapping-node";
import { QualityNode } from "./nodes/quality-node";
import { StoreNode } from "./nodes/store-node";
import { NodeContextMenu } from "./node-context-menu";
import type { PipelineNodeData } from "@/lib/types";

const nodeTypes = {
  source: SourceNode,
  transform: MappingNode,
  quality: QualityNode,
  sink: StoreNode,
};

const defaultEdgeOptions = {
  style: { stroke: "#CBD5E1", strokeWidth: 2 },
  type: "smoothstep" as const,
};

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeLabel: string;
}

export function FlowCanvas() {
  const { projectId } = useActiveProject();
  const pipeline = usePipelineStore((s) => projectId ? s.pipelines[projectId] : null);
  const { onNodesChange, onEdgesChange, addEdge, selectNode, removeNode } = usePipelineStore();
  const { addMessage } = useAgentStore();
  const isPanelOpen = useAgentStore((s) => s.isPanelOpen);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const nodes = pipeline?.nodes ?? [];
  const edges = pipeline?.edges ?? [];

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!projectId) return;
      addEdge(projectId, {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        animated: true,
      });
    },
    [projectId, addEdge],
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
    },
    [projectId, selectNode],
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
      addMessage(projectId, {
        id: `msg-ctx-${Date.now()}`,
        role: "user",
        content: `Tell me about {{${nodeId}}}`,
        timestamp: new Date().toISOString(),
        entities: [{ id: nodeId, type: "table", label }],
      });
      selectNode(projectId, null);
      if (!isPanelOpen) useAgentStore.getState().togglePanel();
    },
    [projectId, addMessage, selectNode, isPanelOpen],
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
        <MiniMap
          nodeStrokeWidth={3}
          className="!rounded-lg !border !border-cm-border-primary !bg-cm-bg-surface !shadow-sm"
        />
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
