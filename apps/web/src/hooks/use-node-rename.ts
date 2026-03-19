import { useState, useRef, useEffect, useCallback } from "react";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useActiveProject } from "@/hooks/use-active-project";

export function useNodeRename(nodeId: string, currentLabel: string) {
  const { projectId } = useActiveProject();
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(currentLabel);
  }, [currentLabel]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== currentLabel && projectId) {
      updateNodeData(projectId, nodeId, { label: trimmed });
    } else {
      setDraft(currentLabel);
    }
    setEditing(false);
  }, [draft, currentLabel, projectId, nodeId, updateNodeData]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") { setDraft(currentLabel); setEditing(false); }
    },
    [commit, currentLabel],
  );

  const startEditing = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(true);
  }, []);

  return { editing, draft, setDraft, inputRef, commit, handleKeyDown, startEditing };
}
