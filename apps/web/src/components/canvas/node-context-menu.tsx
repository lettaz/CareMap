import { useEffect, useRef } from "react";
import { MessageCircle, RefreshCw, Trash2, Palette } from "lucide-react";

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  nodeLabel: string;
  onClose: () => void;
  onSendToChat: (nodeId: string, label: string) => void;
  onRemove: (nodeId: string) => void;
}

export function NodeContextMenu({
  x,
  y,
  nodeLabel,
  nodeId,
  onClose,
  onSendToChat,
  onRemove,
}: NodeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const items = [
    {
      label: "Send to Chat",
      icon: MessageCircle,
      onClick: () => { onSendToChat(nodeId, nodeLabel); onClose(); },
    },
    {
      label: "Recompute Node",
      icon: RefreshCw,
      onClick: () => onClose(),
    },
    {
      label: "Remove from Graph",
      icon: Trash2,
      onClick: () => { onRemove(nodeId); onClose(); },
      destructive: true,
    },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 w-48 rounded-lg border border-cm-border-primary bg-white py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1.5 border-b border-cm-border-subtle">
        <p className="text-[11px] font-medium text-cm-text-primary truncate">{nodeLabel}</p>
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors ${
              item.destructive
                ? "text-red-600 hover:bg-red-50"
                : "text-cm-text-secondary hover:bg-cm-bg-elevated hover:text-cm-text-primary"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
