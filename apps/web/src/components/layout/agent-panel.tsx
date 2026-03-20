import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Sparkles,
  Square,
  SendHorizonal,
  FileSpreadsheet,
  Paperclip,
  ChevronDown,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { apiUrl } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Suggestions,
  Suggestion,
} from "@/components/ai-elements/suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ToolResultRenderer } from "@/components/agent/tool-result-renderer";
import { cn } from "@/lib/utils";

const DESTRUCTIVE_TOOLS = new Set([
  "execute_cleaning",
  "run_harmonization",
  "confirm_mappings",
  "run_script",
]);

const TOOL_LABELS: Record<string, string> = {
  parse_file: "Parsing file",
  profile_columns: "Profiling columns",
  suggest_cleaning: "Suggesting cleaning plan",
  execute_cleaning: "Executing cleaning",
  propose_target_schema: "Proposing schema",
  propose_mappings: "Proposing mappings",
  confirm_mappings: "Confirming mappings",
  run_harmonization: "Running harmonization",
  run_query: "Querying data",
  run_script: "Running script",
  generate_artifact: "Generating artifact",
  explain_lineage: "Explaining lineage",
  run_quality_check: "Running quality check",
  update_semantic_layer: "Updating semantic layer",
  export_data: "Exporting data",
};

const SUGGESTIONS = [
  "Profile a source file",
  "Map fields to canonical schema",
  "Show data quality issues",
  "Query harmonized data",
];

const MODEL_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-sonnet", label: "Claude Sonnet" },
] as const;

export function AgentPanel() {
  const { projectId } = useActiveProject();
  const nodeContext = useAgentStore((s) => s.nodeContext);
  const setNodeContext = useAgentStore((s) => s.setNodeContext);
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState("auto");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chat = useChat({
    transport: new DefaultChatTransport({
      api: apiUrl("/api/chat"),
      body: { projectId, model: model === "auto" ? undefined : model },
    }),
    onError: (error) => {
      console.error("Chat error:", error);
    },
  });

  const { messages, sendMessage, status, stop, addToolApprovalResponse } = chat;

  useEffect(() => {
    if (!nodeContext || !projectId) return;
    const filename = nodeContext.filename ?? nodeContext.label;
    const sfId = nodeContext.sourceFileId ?? "";
    const text = sfId
      ? `Profile @[src ${filename}](${sfId}) and suggest mappings`
      : `Tell me about "${nodeContext.label}"`;

    queueMicrotask(() => {
      setDraft(text);
      textareaRef.current?.focus();
    });
    setNodeContext(null);
  }, [nodeContext, projectId, setNodeContext]);

  const handleSend = useCallback(() => {
    if (!draft.trim()) return;
    sendMessage({ text: draft.trim() });
    setDraft("");
  }, [draft, sendMessage]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setDraft(suggestion);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const isStreaming = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;
  const selectedModel = MODEL_OPTIONS.find((m) => m.value === model) ?? MODEL_OPTIONS[0];

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-cm-bg-app">
      {/* Input area — top, no divider */}
      <div className="shrink-0 px-3 pt-3 pb-2 space-y-2">
        <div className="relative flex items-end rounded-xl border border-cm-border-primary bg-cm-bg-surface shadow-sm">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your data..."
            rows={1}
            className="w-full resize-none bg-transparent px-3 pt-3 pb-9 pr-10 text-sm text-cm-text-primary placeholder:text-cm-text-tertiary outline-none"
          />

          {/* Bottom toolbar inside the input box */}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Attach docs */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv,.tsv,.xlsx,.xls,.json,.pdf,.txt"
                multiple
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-7 w-7 items-center justify-center rounded-md text-cm-text-tertiary hover:bg-cm-bg-hover hover:text-cm-text-secondary transition-colors"
                title="Attach file"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>

              {/* Model selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelMenu((v) => !v)}
                  className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-cm-text-tertiary hover:bg-cm-bg-hover hover:text-cm-text-secondary transition-colors"
                >
                  {selectedModel.label}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showModelMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)} />
                    <div className="absolute bottom-full left-0 z-50 mb-1 rounded-lg border border-cm-border-primary bg-cm-bg-surface py-1 shadow-lg min-w-[140px]">
                      {MODEL_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => { setModel(opt.value); setShowModelMenu(false); }}
                          className={cn(
                            "flex w-full items-center px-3 py-1.5 text-xs transition-colors",
                            opt.value === model
                              ? "bg-cm-accent-subtle text-cm-accent font-medium"
                              : "text-cm-text-secondary hover:bg-cm-bg-hover"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Send / Stop */}
            {isStreaming ? (
              <Button variant="ghost" size="icon" onClick={stop} className="h-7 w-7">
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!draft.trim()}
                className="h-7 w-7 rounded-lg bg-cm-accent text-white hover:bg-cm-accent-hover disabled:opacity-40"
              >
                <SendHorizonal className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages or empty state */}
      {hasMessages ? (
        <Conversation className="flex-1">
          <ConversationContent className="gap-4 p-3">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onApprove={(id) => addToolApprovalResponse({ id, approved: true })}
                onReject={(id) => addToolApprovalResponse({ id, approved: false })}
              />
            ))}
            {isStreaming && (
              <div className="flex items-center gap-2 px-1">
                <Shimmer duration={1.5}>Thinking...</Shimmer>
              </div>
            )}

            {!isStreaming && (
              <Suggestions className="pt-1">
                {SUGGESTIONS.map((s) => (
                  <Suggestion key={s} suggestion={s} onClick={handleSuggestionClick} className="text-xs" />
                ))}
              </Suggestions>
            )}
          </ConversationContent>
        </Conversation>
      ) : (
        <AgentEmptyState onSuggestionClick={handleSuggestionClick} />
      )}
    </aside>
  );
}

interface ChatMessageProps {
  message: UIMessage;
  onApprove: (toolCallId: string) => void;
  onReject: (toolCallId: string) => void;
}

function renderMentions(text: string): ReactNode {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 align-middle"
      >
        <FileSpreadsheet className="h-3 w-3" />
        {match[1]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
}

function ChatMessage({ message, onApprove, onReject }: ChatMessageProps) {
  return (
    <Message from={message.role}>
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          if (!part.text) return null;
          if (message.role === "user") {
            return (
              <MessageContent key={i}>
                <p>{renderMentions(part.text)}</p>
              </MessageContent>
            );
          }
          return (
            <MessageContent key={i}>
              <MessageResponse>{part.text}</MessageResponse>
            </MessageContent>
          );
        }

        if (part.type === "reasoning") {
          return null;
        }

        if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
          const toolPart = part as {
            type: string;
            toolCallId: string;
            toolName?: string;
            state: string;
            input?: unknown;
            output?: unknown;
            errorText?: string;
          };

          const toolName = toolPart.toolName ?? toolPart.type.replace("tool-", "");
          const label = TOOL_LABELS[toolName] ?? toolName;
          const isDestructive = DESTRUCTIVE_TOOLS.has(toolName);

          if (isDestructive && toolPart.state === "approval-requested") {
            return (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                <p className="font-medium text-amber-800">
                  Approve <strong>{label}</strong>?
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onReject(toolPart.toolCallId)}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-cm-accent text-white hover:bg-cm-accent-hover"
                    onClick={() => onApprove(toolPart.toolCallId)}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            );
          }

          if (toolPart.state === "output-available" && toolPart.output != null) {
            return (
              <ToolResultRenderer key={i} toolName={toolName} output={toolPart.output} />
            );
          }

          const statusColor = toolPart.state === "output-error"
            ? "text-red-600"
            : toolPart.state === "output-available"
              ? "text-green-600"
              : "text-cm-text-tertiary";

          return (
            <div key={i} className="flex items-center gap-2 text-xs py-1">
              <div className={`h-1.5 w-1.5 rounded-full ${
                toolPart.state === "output-error" ? "bg-red-500"
                : toolPart.state === "output-available" ? "bg-green-500"
                : "bg-cm-accent animate-pulse"
              }`} />
              <span className={statusColor}>{label}</span>
            </div>
          );
        }

        return null;
      })}
    </Message>
  );
}

function AgentEmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 overflow-auto">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-cm-accent-subtle">
          <Sparkles className="h-5 w-5 text-cm-accent" />
        </div>
        <h3 className="text-sm font-semibold text-cm-text-primary">CareMap AI</h3>
        <p className="mt-1 text-xs text-cm-text-secondary leading-relaxed max-w-[260px] mx-auto">
          Ask me to profile sources, suggest mappings, investigate anomalies, or query your harmonised data.
        </p>
      </div>

      <div className="w-full max-w-[280px] space-y-1.5">
        <p className="text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide px-1">
          Try asking
        </p>
        {SUGGESTIONS.map((label) => (
          <button
            key={label}
            onClick={() => onSuggestionClick(label)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-cm-border-primary bg-white px-3 py-2.5 text-left text-xs text-cm-text-secondary transition-colors hover:bg-cm-bg-elevated hover:text-cm-text-primary"
          >
            <Sparkles className="h-3 w-3 text-cm-accent shrink-0" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
