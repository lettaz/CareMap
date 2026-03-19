import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableLabelProps {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function EditableLabel({
  value,
  onCommit,
  className,
  placeholder = "Untitled",
}: EditableLabelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  }, [draft, value, onCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        setDraft(value);
        setEditing(false);
      }
    },
    [commit, value],
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full rounded border border-cm-accent bg-cm-bg-surface px-1.5 py-0.5 outline-none ring-1 ring-cm-accent/30",
          className,
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "group flex items-center gap-1.5 truncate rounded px-1.5 py-0.5 -mx-1.5 text-left transition-colors hover:bg-cm-bg-elevated",
        className,
      )}
      title="Click to rename"
    >
      <span className="truncate">{value || placeholder}</span>
      <Pencil className="h-3 w-3 shrink-0 text-cm-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
