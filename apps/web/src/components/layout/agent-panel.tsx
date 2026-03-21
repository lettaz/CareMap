import { useCallback, useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  Sparkles,
  Square,
  SendHorizonal,
  FileSpreadsheet,
  Paperclip,
  ChevronDown,
  ChevronRight,
  X,
  Database,
  GitMerge,
  ShieldCheck,
  HardDriveDownload,
  Trash2,
  Loader2,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import type { UIMessage } from "ai";
import { useAgentStore } from "@/lib/stores/agent-store";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
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
import type { NodeCategory } from "@/lib/types";

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

interface MentionChip {
  label: string;
  id: string;
  sourceFileId?: string;
  category: NodeCategory;
}

const CATEGORY_ICONS: Record<string, typeof Database> = {
  source: Database,
  transform: GitMerge,
  harmonize: Database,
  quality: ShieldCheck,
  sink: HardDriveDownload,
};

const CATEGORY_COLORS: Record<string, string> = {
  source: "bg-blue-50 text-blue-700",
  transform: "bg-violet-50 text-violet-700",
  harmonize: "bg-cyan-50 text-cyan-700",
  quality: "bg-amber-50 text-amber-700",
  sink: "bg-emerald-50 text-emerald-700",
};

function extractInputSnippet(toolName: string, input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const inp = input as Record<string, unknown>;

  switch (toolName) {
    case "run_query":
      return (inp.sql as string) ?? (inp.query as string) ?? null;
    case "run_script":
      return (inp.code as string) ?? (inp.script as string) ?? null;
    case "execute_cleaning":
      return inp.actions ? `Cleaning ${(inp.actions as unknown[]).length} action(s)` : null;
    case "propose_target_schema":
      return inp.sourceFileIds
        ? `Analyzing ${(inp.sourceFileIds as string[]).length} source file(s)`
        : null;
    case "propose_mappings":
      return inp.sourceFileIds
        ? `Mapping ${(inp.sourceFileIds as string[]).length} source(s) to schema`
        : null;
    case "generate_artifact":
      return (inp.userQuestion as string) ?? null;
    case "export_data":
      return inp.format ? `Exporting as ${inp.format}` : null;
    default:
      return null;
  }
}

const _consumedPendingKeys = new Set<string>();

function buildMentionMarkup(mention: MentionChip): string {
  const ref = mention.sourceFileId ?? mention.id;
  const tag = `@[${mention.label}](${ref})`;

  switch (mention.category) {
    case "transform":
      return `${tag} [transform node — can generate schema & field mappings]`;
    case "harmonize":
      return `${tag} [harmonize node — can run harmonization on accepted mappings]`;
    case "quality":
      return `${tag} [quality check node — can run data quality checks]`;
    case "sink":
      return `${tag} [export/store node — can export harmonized data]`;
    default:
      return tag;
  }
}

function chatStorageKey(projectId: string) {
  return `caremap-chat:${projectId}`;
}

function loadPersistedMessages(projectId: string | undefined): UIMessage[] {
  if (!projectId) return [];
  try {
    const raw = localStorage.getItem(chatStorageKey(projectId));
    if (!raw) return [];
    return JSON.parse(raw) as UIMessage[];
  } catch {
    return [];
  }
}

function persistMessages(projectId: string | undefined, messages: UIMessage[]) {
  if (!projectId) return;
  try {
    if (messages.length === 0) {
      localStorage.removeItem(chatStorageKey(projectId));
    } else {
      localStorage.setItem(chatStorageKey(projectId), JSON.stringify(messages));
    }
  } catch { /* quota exceeded — silent */ }
}

const EMPTY_NODES: never[] = [];

export function AgentPanel() {
  const { projectId } = useParams<{ projectId: string }>();
  const nodeContext = useAgentStore((s) => s.nodeContext);
  const setNodeContext = useAgentStore((s) => s.setNodeContext);
  const openPanel = useAgentStore((s) => s.openPanel);
  const pipelineNodes = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes ?? EMPTY_NODES : EMPTY_NODES,
  );

  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState<MentionChip[]>([]);
  const [model, setModel] = useState("auto");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionTriggerPos, setMentionTriggerPos] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);

  const initialMessages = useMemo(() => loadPersistedMessages(projectId), [projectId]);

  const filteredNodes = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const alreadyMentioned = new Set(mentions.map((m) => m.id));
    return pipelineNodes
      .filter((n) => !alreadyMentioned.has(n.id) && n.data.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionQuery, pipelineNodes, mentions]);

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: apiUrl("/api/chat"),
      body: { projectId: projectId ?? "" },
    }),
    [projectId],
  );

  const chat = useChat({
    transport,
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError: (error) => {
      console.error("Chat error:", error);
    },
  });

  const { messages, sendMessage, status, error, stop, setMessages, addToolApprovalResponse } = chat;

  useEffect(() => {
    if (status === "ready") {
      persistMessages(projectId, messages);
    }
  }, [messages, status, projectId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    persistMessages(projectId, []);
  }, [setMessages, projectId]);

  const nodeContextConsumedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!nodeContext || !projectId) return;
    const contextKey = `${nodeContext.nodeId}::${nodeContext.sourceFileId ?? ""}`;
    if (nodeContextConsumedRef.current === contextKey) return;
    nodeContextConsumedRef.current = contextKey;

    const filename = nodeContext.filename ?? nodeContext.label;
    const sfId = nodeContext.sourceFileId ?? "";
    const matchedNode = pipelineNodes.find((n) => n.data.sourceFileId === sfId);
    const nodeId = matchedNode?.id ?? nodeContext.nodeId;
    const category = matchedNode?.data.category ?? "source";

    queueMicrotask(() => {
      if (sfId) {
        setMentions((prev) => {
          if (prev.some((m) => m.id === nodeId)) return prev;
          return [...prev, { label: filename, id: nodeId, sourceFileId: sfId, category }];
        });
      }
      setDraft("");
      textareaRef.current?.focus();
    });
    setNodeContext(null);
    setTimeout(() => { nodeContextConsumedRef.current = null; }, 2000);
  }, [nodeContext, projectId, setNodeContext, pipelineNodes]);

  const pendingMessage = useAgentStore((s) => s.pendingMessage);
  const setPendingMessage = useAgentStore((s) => s.setPendingMessage);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const activeTransformRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingMessage || !projectId || status !== "ready") return;

    const msgKey = `${pendingMessage.text}::${pendingMessage.mentions.map((m) => m.id).join(",")}`;
    if (_consumedPendingKeys.has(msgKey)) return;
    _consumedPendingKeys.add(msgKey);

    const { text, mentions: pendingMentions, transformNodeId } = pendingMessage;
    setPendingMessage(null);
    openPanel();

    if (transformNodeId) activeTransformRef.current = transformNodeId;

    const mentionMarkup = pendingMentions
      .map((m) => buildMentionMarkup({
        label: m.label,
        id: m.id,
        sourceFileId: m.sourceFileId,
        category: m.category,
      }))
      .join(" ");
    const composed = mentionMarkup ? `${mentionMarkup} ${text}` : text;
    sendMessage({ text: composed });

    setTimeout(() => { _consumedPendingKeys.delete(msgKey); }, 5000);
  }, [pendingMessage, projectId, status, setPendingMessage, openPanel, sendMessage]);

  useEffect(() => {
    if (status !== "ready" || !activeTransformRef.current || !projectId) return;
    updateNodeData(projectId, activeTransformRef.current, { status: "ready" });
    activeTransformRef.current = null;
  }, [status, projectId, updateNodeData]);

  const insertMention = useCallback(
    (node: { id: string; data: { label: string; category: NodeCategory; sourceFileId?: string } }) => {
      setMentions((prev) => {
        if (prev.some((m) => m.id === node.id)) return prev;
        return [...prev, {
          label: node.data.label,
          id: node.id,
          sourceFileId: node.data.sourceFileId as string | undefined,
          category: node.data.category,
        }];
      });

      if (mentionTriggerPos !== null) {
        const before = draft.slice(0, mentionTriggerPos);
        const afterAt = draft.slice(mentionTriggerPos);
        const spaceIdx = afterAt.search(/\s/);
        const after = spaceIdx === -1 ? "" : afterAt.slice(spaceIdx);
        setDraft(before + after.trimStart());
      }

      setMentionQuery(null);
      setMentionTriggerPos(null);
      setMentionIdx(0);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [draft, mentionTriggerPos],
  );

  const removeMention = useCallback((id: string) => {
    setMentions((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleSend = useCallback(() => {
    if (!projectId) return;
    if (!draft.trim() && mentions.length === 0) return;
    const mentionParts = mentions.map(buildMentionMarkup).join(" ");
    const text = mentionParts ? `${mentionParts} ${draft.trim()}` : draft.trim();
    sendMessage({ text });
    setDraft("");
    setMentions([]);
    setMentionQuery(null);
    setMentionTriggerPos(null);
  }, [draft, mentions, sendMessage, projectId]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setDraft(suggestion);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [],
  );

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const cursor = e.target.selectionStart ?? value.length;
      setDraft(value);

      const textBeforeCursor = value.slice(0, cursor);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (atMatch) {
        setMentionQuery(atMatch[1]);
        setMentionTriggerPos(textBeforeCursor.length - atMatch[0].length);
        setMentionIdx(0);
      } else {
        setMentionQuery(null);
        setMentionTriggerPos(null);
      }

      autoResize();
    },
    [autoResize],
  );

  useEffect(() => {
    autoResize();
  }, [draft, autoResize]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (mentionQuery !== null && filteredNodes.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIdx((i) => Math.min(i + 1, filteredNodes.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIdx((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(filteredNodes[mentionIdx]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMentionQuery(null);
          setMentionTriggerPos(null);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }

      if (e.key === "Backspace" && draft === "" && mentions.length > 0) {
        e.preventDefault();
        setMentions((prev) => prev.slice(0, -1));
      }
    },
    [handleSend, mentionQuery, filteredNodes, mentionIdx, insertMention, draft, mentions],
  );

  const isStreaming = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;
  const selectedModel = MODEL_OPTIONS.find((m) => m.value === model) ?? MODEL_OPTIONS[0];
  const showMentionMenu = mentionQuery !== null && filteredNodes.length > 0;

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-cm-bg-app">
      {hasMessages && (
        <div className="flex items-center justify-between shrink-0 px-3 pt-2.5 pb-1">
          <span className="text-[11px] font-medium text-cm-text-tertiary">CareMap AI</span>
          <button
            type="button"
            onClick={clearChat}
            disabled={isStreaming}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-cm-text-tertiary hover:bg-cm-bg-hover hover:text-cm-text-secondary transition-colors disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

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
              <div className="flex items-center gap-2 px-1 text-[11px]">
                <Shimmer duration={1.5}>Thinking...</Shimmer>
              </div>
            )}

            {status === "error" && error && (
              <div className="mx-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
                <p className="font-medium">Something went wrong</p>
                <p className="mt-0.5 text-red-600">{error.message}</p>
              </div>
            )}

            {!isStreaming && (
              <Suggestions className="pt-1">
                {SUGGESTIONS.map((s) => (
                  <Suggestion key={s} suggestion={s} onClick={handleSuggestionClick} className="text-[11px]" />
                ))}
              </Suggestions>
            )}
          </ConversationContent>
        </Conversation>
      ) : (
        <AgentEmptyState onSuggestionClick={handleSuggestionClick} />
      )}

      {/* Input area — bottom, no divider */}
      <div className="shrink-0 px-3 pt-2 pb-3">
        <div className="relative flex flex-col rounded-xl border border-cm-border-primary bg-cm-bg-surface shadow-sm">
          {mentions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5 pb-0">
              {mentions.map((m) => {
                const Icon = CATEGORY_ICONS[m.category] ?? Database;
                const colorClass = CATEGORY_COLORS[m.category] ?? CATEGORY_COLORS.source;
                return (
                  <span
                    key={m.id}
                    className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium", colorClass)}
                  >
                    <Icon className="h-3 w-3" />
                    {m.label}
                    <button
                      type="button"
                      onClick={() => removeMention(m.id)}
                      className="ml-0.5 rounded-sm opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={mentions.length > 0 ? "Type your question..." : "Ask anything about your data... (@ to mention a node)"}
            rows={1}
            className="w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-xs text-cm-text-primary placeholder:text-cm-text-tertiary outline-none"
            style={{ maxHeight: 160 }}
          />

          {/* @ mention autocomplete */}
          {showMentionMenu && (
            <div
              ref={mentionListRef}
              className="absolute bottom-full left-0 right-0 z-50 mb-1 mx-1 max-h-52 overflow-y-auto rounded-lg border border-cm-border-primary bg-cm-bg-surface py-1 shadow-lg"
            >
              <p className="px-3 py-1 text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide">
                Pipeline nodes
              </p>
              {filteredNodes.map((node, i) => {
                const Icon = CATEGORY_ICONS[node.data.category] ?? Database;
                const subtitle = node.data.sourceFileId
                  ? String(node.data.sourceFileId).slice(0, 8)
                  : node.id.slice(0, 8);
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => insertMention(node)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors",
                      i === mentionIdx
                        ? "bg-cm-accent-subtle text-cm-accent"
                        : "text-cm-text-secondary hover:bg-cm-bg-hover"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate font-medium">{node.data.label}</span>
                      <span className="block truncate text-[10px] text-cm-text-tertiary">{subtitle}</span>
                    </div>
                    <span className="text-[10px] text-cm-text-tertiary capitalize shrink-0">{node.data.category}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <div className="flex items-center gap-1">
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

            {isStreaming ? (
              <Button variant="ghost" size="icon" onClick={stop} className="h-7 w-7">
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!draft.trim() && mentions.length === 0}
                className="h-7 w-7 rounded-lg bg-cm-accent text-white hover:bg-cm-accent-hover disabled:opacity-40"
              >
                <SendHorizonal className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
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

function CollapsibleToolResult({
  label,
  toolName,
  output,
  defaultOpen,
}: {
  label: string;
  toolName: string;
  output: unknown;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-cm-border-primary overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-cm-text-secondary hover:bg-cm-bg-hover transition-colors"
      >
        <div className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className="truncate">{label}</span>
      </button>
      {open && (
        <div className="border-t border-cm-border-subtle">
          <ToolResultRenderer toolName={toolName} output={output} />
        </div>
      )}
    </div>
  );
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
            const approvalId = (toolPart as unknown as { approval?: { id: string } }).approval?.id ?? toolPart.toolCallId;
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
                    onClick={() => onReject(approvalId)}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-cm-accent text-white hover:bg-cm-accent-hover"
                    onClick={() => onApprove(approvalId)}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            );
          }

          if (toolPart.state === "output-available" && toolPart.output != null) {
            const expandByDefault = toolName === "generate_artifact";
            return (
              <CollapsibleToolResult
                key={i}
                label={label}
                toolName={toolName}
                output={toolPart.output}
                defaultOpen={expandByDefault}
              />
            );
          }

          const isRunning = toolPart.state === "running" || toolPart.state === "streaming" || toolPart.state === "partial-call";
          const isError = toolPart.state === "output-error";
          const statusColor = isError ? "text-red-600" : isRunning ? "text-cm-accent" : "text-cm-text-tertiary";
          const dotClass = isError ? "bg-red-500" : isRunning ? "bg-cm-accent animate-pulse" : "bg-slate-300";

          const inputSnippet = extractInputSnippet(toolName, toolPart.input);

          return (
            <div key={i} className="rounded-lg border border-cm-border-primary overflow-hidden">
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />
                <span className={cn("font-medium", statusColor)}>{label}</span>
                {isRunning && <Loader2 className="h-3 w-3 animate-spin text-cm-accent ml-auto shrink-0" />}
              </div>
              {inputSnippet && (
                <div className="border-t border-cm-border-subtle bg-cm-bg-elevated/50 px-2.5 py-2 max-h-28 overflow-auto">
                  <pre className="text-[10px] leading-relaxed text-cm-text-secondary font-mono whitespace-pre-wrap break-all">
                    {inputSnippet}
                  </pre>
                </div>
              )}
              {isError && toolPart.errorText && (
                <div className="border-t border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] text-red-600">
                  {toolPart.errorText}
                </div>
              )}
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
        <h3 className="text-xs font-semibold text-cm-text-primary">CareMap AI</h3>
        <p className="mt-1 text-[11px] text-cm-text-secondary leading-relaxed max-w-[260px] mx-auto">
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
            className="flex w-full items-center gap-2.5 rounded-lg border border-cm-border-primary bg-white px-2.5 py-2 text-left text-[11px] text-cm-text-secondary transition-colors hover:bg-cm-bg-elevated hover:text-cm-text-primary"
          >
            <Sparkles className="h-3 w-3 text-cm-accent shrink-0" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
