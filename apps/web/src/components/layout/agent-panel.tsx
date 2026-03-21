import { useCallback, useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  Sparkles,
  Square,
  SendHorizonal,
  Paperclip,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
  Plus,
  MessageSquare,
  History,
} from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import type { UIMessage } from "ai";
import { useAgentStore } from "@/lib/stores/agent-store";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useChatSessionStore } from "@/lib/stores/chat-session-store";
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
import { ChatEditor, type ChatEditorHandle } from "@/components/agent/chat-editor";
import { CareMapMark } from "@/components/shared/caremap-logo";
import { buildMentionMarkup } from "@/lib/mention-markup";
import { cn } from "@/lib/utils";

const DESTRUCTIVE_TOOLS = new Set([
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

const DEFAULT_SUGGESTIONS = [
  "Profile a source file",
  "Map fields to canonical schema",
  "Show data quality issues",
  "Query harmonized data",
];

const TOOL_FOLLOW_UPS: Record<string, string[]> = {
  parse_file: ["Profile this source data", "Check for quality issues in this file"],
  profile_columns: ["Suggest a cleaning plan", "Propose a target schema"],
  suggest_cleaning: ["Execute this cleaning plan", "Modify the cleaning plan"],
  execute_cleaning: ["Re-profile the cleaned data", "Propose a target schema"],
  propose_target_schema: ["Show the proposed schema details", "Propose field mappings"],
  propose_mappings: ["Review the mappings", "Accept all high-confidence mappings"],
  confirm_mappings: ["Run harmonization", "Check mapping coverage"],
  run_harmonization: ["Run a quality check", "Query the harmonized data"],
  run_query: ["Export this data as CSV", "Generate a chart from these results"],
  run_script: ["Query the results", "Export the output"],
  generate_artifact: ["Pin this to the dashboard", "Run another query"],
  run_quality_check: ["Show the quality alerts", "Fix the flagged issues"],
  export_data: ["Export in another format", "Query more data"],
  explain_lineage: ["Query harmonized data", "Run a quality check"],
};

function extractToolName(part: { type: string; toolName?: string }): string | null {
  if (part.type === "dynamic-tool") return part.toolName ?? null;
  if (part.type.startsWith("tool-")) return part.type.slice(5);
  return null;
}

function deriveContextualSuggestions(messages: UIMessage[]): string[] {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant?.parts) return DEFAULT_SUGGESTIONS;

  const toolNames: string[] = [];
  for (const part of lastAssistant.parts) {
    const name = extractToolName(part as { type: string; toolName?: string });
    if (name) toolNames.push(name);
  }

  if (toolNames.length === 0) return DEFAULT_SUGGESTIONS;

  const lastTool = toolNames[toolNames.length - 1];
  return TOOL_FOLLOW_UPS[lastTool] ?? DEFAULT_SUGGESTIONS;
}

const MODEL_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-sonnet", label: "Claude Sonnet" },
] as const;

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
const EMPTY_NODES: never[] = [];

export function AgentPanel() {
  const { projectId } = useParams<{ projectId: string }>();
  const nodeContext = useAgentStore((s) => s.nodeContext);
  const setNodeContext = useAgentStore((s) => s.setNodeContext);
  const openPanel = useAgentStore((s) => s.openPanel);
  const pipelineNodes = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes ?? EMPTY_NODES : EMPTY_NODES,
  );

  const {
    sessions,
    activeSessionId,
    loaded: sessionsLoaded,
    loadSessions,
    createSession,
    switchSession,
    deleteSession,
    updateMessages,
  } = useChatSessionStore();

  useEffect(() => {
    if (projectId && !sessionsLoaded) loadSessions(projectId);
  }, [projectId, sessionsLoaded, loadSessions]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const editorRef = useRef<ChatEditorHandle>(null);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [model, setModel] = useState("auto");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialMessages = useMemo(
    () => activeSession?.messages ?? [],
    [activeSession?.id],
  );

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

  const contextualSuggestions = useMemo(
    () => deriveContextualSuggestions(messages),
    [messages],
  );

  useEffect(() => {
    if (status === "ready" && projectId && activeSessionId) {
      updateMessages(projectId, activeSessionId, messages);
    }
  }, [messages, status, projectId, activeSessionId, updateMessages]);

  const handleNewChat = useCallback(() => {
    if (!projectId) return;
    createSession(projectId);
    setMessages([]);
    editorRef.current?.clear();
    setShowSessionList(false);
  }, [projectId, createSession, setMessages]);

  const handleSwitchSession = useCallback((sessionId: string) => {
    if (!projectId) return;
    switchSession(projectId, sessionId);
    const session = sessions.find((s) => s.id === sessionId);
    setMessages(session?.messages ?? []);
    editorRef.current?.clear();
    setShowSessionList(false);
  }, [projectId, switchSession, sessions, setMessages]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    if (!projectId) return;
    deleteSession(projectId, sessionId);
    if (sessionId === activeSessionId) {
      setMessages([]);
    }
    setShowSessionList(false);
  }, [projectId, deleteSession, activeSessionId, setMessages]);

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
        editorRef.current?.insertMention({
          id: nodeId,
          label: filename,
          category,
          sourceFileId: sfId,
        });
      }
      editorRef.current?.focus();
    });
    setNodeContext(null);
    setTimeout(() => { nodeContextConsumedRef.current = null; }, 2000);
  }, [nodeContext, projectId, setNodeContext, pipelineNodes]);

  const pendingMessage = useAgentStore((s) => s.pendingMessage);
  const setPendingMessage = useAgentStore((s) => s.setPendingMessage);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const activeTransformRef = useRef<string | null>(null);
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    if (!pendingMessage || !projectId || status !== "ready") return;

    const msgKey = `${pendingMessage.text}::${pendingMessage.mentions.map((m) => m.id).join(",")}`;
    if (_consumedPendingKeys.has(msgKey)) return;
    _consumedPendingKeys.add(msgKey);

    if (!activeSessionId) createSession(projectId);

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
  }, [pendingMessage, projectId, status, setPendingMessage, openPanel, sendMessage, activeSessionId, createSession]);

  useEffect(() => {
    if (status !== "ready") {
      wasStreamingRef.current = true;
      return;
    }
    if (!wasStreamingRef.current || !activeTransformRef.current || !projectId) return;
    wasStreamingRef.current = false;
    updateNodeData(projectId, activeTransformRef.current, { status: "ready" });
    activeTransformRef.current = null;
  }, [status, projectId, updateNodeData]);

  const handleEditorSend = useCallback(
    (text: string) => {
      if (!projectId) return;
      if (!activeSessionId) createSession(projectId);
      sendMessage({ text });
    },
    [projectId, activeSessionId, createSession, sendMessage],
  );

  const handleManualSend = useCallback(() => {
    const text = editorRef.current?.getSerializedContent();
    if (!text?.trim()) return;
    handleEditorSend(text);
    editorRef.current?.clear();
  }, [handleEditorSend]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      handleEditorSend(suggestion);
    },
    [handleEditorSend],
  );

  const isStreaming = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;
  const selectedModel = MODEL_OPTIONS.find((m) => m.value === model) ?? MODEL_OPTIONS[0];

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-cm-bg-app">
      {/* Session tab bar */}
      <div className="flex items-center shrink-0 border-b border-cm-border-primary bg-cm-bg-surface">
        <div className="flex flex-1 items-center overflow-x-auto min-w-0">
          {sessions.slice(0, 6).map((s) => {
            const isActive = s.id === activeSessionId;
            return (
              <div key={s.id} className={cn("group relative flex items-center shrink-0 max-w-[160px]")}>
                <button
                  type="button"
                  onClick={() => handleSwitchSession(s.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors min-w-0",
                    isActive
                      ? "text-cm-text-primary border-b-2 border-cm-accent"
                      : "text-cm-text-tertiary hover:text-cm-text-secondary border-b-2 border-transparent",
                  )}
                >
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">{s.title}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex h-4 w-4 items-center justify-center rounded text-cm-text-tertiary hover:text-red-500 transition-all"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-0.5 px-1.5 shrink-0 border-l border-cm-border-subtle">
          <button
            type="button"
            onClick={handleNewChat}
            disabled={isStreaming}
            className="flex h-7 w-7 items-center justify-center rounded-md text-cm-text-tertiary hover:bg-cm-bg-hover hover:text-cm-text-secondary transition-colors disabled:opacity-40"
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSessionList((v) => !v)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                showSessionList
                  ? "bg-cm-bg-hover text-cm-text-secondary"
                  : "text-cm-text-tertiary hover:bg-cm-bg-hover hover:text-cm-text-secondary",
              )}
              title="Chat history"
            >
              <History className="h-3.5 w-3.5" />
            </button>
            {showSessionList && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSessionList(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-cm-border-primary bg-cm-bg-surface py-1 shadow-lg max-h-80 overflow-y-auto">
                  <p className="px-3 py-1.5 text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide">
                    All Chats ({sessions.length})
                  </p>
                  {sessions.length === 0 && (
                    <p className="px-3 py-3 text-[11px] text-cm-text-tertiary text-center">No chats yet</p>
                  )}
                  {sessions.map((s) => {
                    const isActive = s.id === activeSessionId;
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 transition-colors group",
                          isActive ? "bg-cm-accent-subtle" : "hover:bg-cm-bg-hover",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleSwitchSession(s.id)}
                          className="flex flex-1 items-center gap-2 min-w-0 text-left"
                        >
                          <MessageSquare className={cn(
                            "h-3 w-3 shrink-0",
                            isActive ? "text-cm-accent" : "text-cm-text-tertiary",
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-[11px] truncate",
                              isActive ? "text-cm-accent font-medium" : "text-cm-text-secondary",
                            )}>
                              {s.title}
                            </p>
                            <p className="text-[9px] text-cm-text-tertiary">
                              {s.messages.length} msg{s.messages.length !== 1 ? "s" : ""}
                              {" · "}
                              {formatSessionAge(s.updatedAt)}
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                          className="shrink-0 opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-cm-text-tertiary hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Delete"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
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
                {contextualSuggestions.map((s) => (
                  <Suggestion key={s} suggestion={s} onClick={handleSuggestionClick} className="text-[11px]" />
                ))}
              </Suggestions>
            )}
          </ConversationContent>
        </Conversation>
      ) : (
        <AgentEmptyState onSuggestionClick={handleSuggestionClick} />
      )}

      {/* Input area */}
      <div className="shrink-0 px-3 pt-2 pb-3">
        <div className="relative flex flex-col rounded-xl border border-cm-border-primary bg-cm-bg-surface shadow-sm">
          <ChatEditor
            ref={editorRef}
            onSend={handleEditorSend}
            onEmptyChange={setEditorEmpty}
            pipelineNodes={pipelineNodes}
            disabled={isStreaming}
          />

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
                onClick={handleManualSend}
                disabled={editorEmpty}
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
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)(\s*\[[^\]]*\])?/g;
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
        className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 align-baseline"
      >
        @{match[1]}
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
            const expandByDefault = toolName === "generate_artifact"
              || toolName === "suggest_cleaning"
              || toolName === "propose_target_schema"
              || toolName === "propose_mappings";

            const RESULT_LABELS: Record<string, string> = {
              profile_columns: "Column Profile",
              suggest_cleaning: "Cleaning Plan Ready",
              execute_cleaning: "Cleaning Complete",
              propose_target_schema: "Target Schema Proposed",
              propose_mappings: "Field Mappings Ready",
              run_harmonization: "Harmonization Complete",
              run_query: "Query Results",
              generate_artifact: "Artifact Generated",
            };
            const displayLabel = RESULT_LABELS[toolName] ?? label;
            return (
              <CollapsibleToolResult
                key={i}
                label={displayLabel}
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
        <CareMapMark size={32} className="mx-auto mb-3" />
        <h3 className="text-xs font-semibold text-cm-text-primary">What can I help with?</h3>
        <p className="mt-1 text-[11px] text-cm-text-secondary leading-relaxed max-w-[260px] mx-auto">
          Profile sources, suggest mappings, investigate anomalies, or query your harmonised data.
        </p>
      </div>

      <div className="w-full max-w-[280px] space-y-1.5">
        <p className="text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide px-1">
          Try asking
        </p>
        {DEFAULT_SUGGESTIONS.map((label) => (
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

function formatSessionAge(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
