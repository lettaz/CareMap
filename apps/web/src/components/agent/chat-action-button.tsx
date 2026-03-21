import { type ReactNode, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore, type PendingMention } from "@/lib/stores/agent-store";
import { cn } from "@/lib/utils";

type ChatActionVariant = "primary" | "secondary" | "ghost";

interface ChatActionButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  variant?: ChatActionVariant;
  nodeId?: string;
  prompt?: string;
  mentions?: PendingMention[];
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

const VARIANT_MAP: Record<ChatActionVariant, "default" | "outline" | "ghost"> = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
};

export function ChatActionButton({
  children,
  icon,
  variant = "secondary",
  nodeId,
  prompt,
  mentions,
  onClick,
  disabled,
  className,
}: ChatActionButtonProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const selectNode = usePipelineStore((s) => s.selectNode);
  const openPanel = useAgentStore((s) => s.openPanel);
  const setPendingMessage = useAgentStore((s) => s.setPendingMessage);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }

    if (nodeId && projectId) {
      selectNode(projectId, nodeId);
      return;
    }

    if (prompt) {
      openPanel();
      setPendingMessage({
        text: prompt,
        mentions: mentions ?? [],
      });
    }
  }, [onClick, nodeId, projectId, prompt, mentions, selectNode, openPanel, setPendingMessage]);

  return (
    <Button
      variant={VARIANT_MAP[variant]}
      size="sm"
      className={cn("h-7 gap-1.5 text-[11px]", className)}
      onClick={handleClick}
      disabled={disabled}
    >
      {icon ?? (nodeId ? <ExternalLink className="h-3 w-3" /> : null)}
      {children}
    </Button>
  );
}
