import type { useNodeRename } from "@/hooks/use-node-rename";

interface NodeLabelInputProps {
  rename: ReturnType<typeof useNodeRename>;
}

export function NodeLabelInput({ rename }: NodeLabelInputProps) {
  const { editing, draft, setDraft, inputRef, commit, handleKeyDown, startEditing } = rename;

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-full min-w-0 rounded border border-cm-accent bg-white px-1 py-0 text-sm font-medium text-cm-text-primary outline-none ring-1 ring-cm-accent/30"
      />
    );
  }

  return (
    <span
      className="truncate text-sm font-medium text-cm-text-primary cursor-text"
      onDoubleClick={startEditing}
      title="Double-click to rename"
    >
      {draft}
    </span>
  );
}
