import { useEffect, useRef, Fragment } from "react";
import { Check, X } from "lucide-react";
import { EntityPill } from "./entity-pill";
import { ToolSteps } from "./tool-steps";
import { ArtifactTabs } from "./artifact-tabs";
import type { AgentMessage, EntityRef } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageThreadProps {
  messages: AgentMessage[];
  agentColor: string;
}

export function MessageThread({ messages }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
      {messages.map((msg) => (
        <Fragment key={msg.id}>
          {msg.role === "user" ? (
            <UserBlock message={msg} />
          ) : (
            <AgentBlock message={msg} />
          )}
        </Fragment>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

/* ─── User block ─── */

function UserBlock({ message }: { message: AgentMessage }) {
  return (
    <div className="mb-4">
      <div className="text-sm text-cm-text-primary leading-relaxed">
        <RichContent content={message.content} entities={message.entities} />
      </div>
    </div>
  );
}

/* ─── Agent block ─── */

function AgentBlock({ message }: { message: AgentMessage }) {
  return (
    <div className="mb-5 space-y-3">
      {/* Tool steps */}
      {message.toolSteps && message.toolSteps.length > 0 && (
        <ToolSteps steps={message.toolSteps} />
      )}

      {/* Content */}
      {message.content && (
        <div className="text-xs text-cm-text-primary leading-relaxed">
          <RichContent content={message.content} entities={message.entities} />
        </div>
      )}

      {/* Approval block */}
      {message.approval && (
        <ApprovalBlock
          status={message.approval.status}
          label={message.approval.label}
        />
      )}

      {/* Artifact tabs */}
      {message.artifacts && message.artifacts.length > 0 && (
        <ArtifactTabs tabs={message.artifacts} />
      )}
    </div>
  );
}

/* ─── Rich content renderer ─── */

function RichContent({ content, entities }: { content: string; entities?: EntityRef[] }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;

        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-cm-text-tertiary mt-px shrink-0">&#8226;</span>
              <span>
                <FormattedLine text={line.slice(2)} entities={entities} />
              </span>
            </div>
          );
        }

        return (
          <p key={i}>
            <FormattedLine text={line} entities={entities} />
          </p>
        );
      })}
    </div>
  );
}

function FormattedLine({ text, entities }: { text: string; entities?: EntityRef[] }) {
  if (!entities || entities.length === 0) {
    const formatted = text.replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="font-semibold">$1</strong>'
    );
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  }

  const parts: (string | EntityRef)[] = [];
  let remaining = text;

  for (const entity of entities) {
    const marker = `{{${entity.id}}}`;
    const idx = remaining.indexOf(marker);
    if (idx === -1) continue;
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push(entity);
    remaining = remaining.slice(idx + marker.length);
  }
  if (remaining) parts.push(remaining);

  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === "string") {
          const formatted = part.replace(
            /\*\*(.+?)\*\*/g,
            '<strong class="font-semibold">$1</strong>'
          );
          return <span key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
        }
        return <EntityPill key={i} entity={part} className="mx-0.5" />;
      })}
    </>
  );
}

/* ─── Approval block ─── */

function ApprovalBlock({ status, label }: { status: "pending" | "accepted" | "rejected"; label: string }) {
  if (status === "accepted") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span className="text-xs font-medium text-emerald-700">{label}</span>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
        <X className="h-3.5 w-3.5 text-red-600 shrink-0" />
        <span className="text-xs font-medium text-red-700">{label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-cm-border-primary bg-cm-bg-elevated px-3 py-2">
      <span className="text-xs text-cm-text-secondary">{label}</span>
      <div className="ml-auto flex gap-1.5">
        <button className={cn(
          "rounded-md bg-cm-accent px-3 py-1 text-[11px] font-medium text-white",
          "hover:bg-cm-accent-hover transition-colors"
        )}>
          Accept
        </button>
        <button className={cn(
          "rounded-md border border-cm-border-primary bg-white px-3 py-1 text-[11px] font-medium text-cm-text-secondary",
          "hover:bg-cm-bg-elevated transition-colors"
        )}>
          Reject
        </button>
      </div>
    </div>
  );
}
