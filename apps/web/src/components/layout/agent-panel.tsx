import { useState, useRef } from "react";
import { Sparkles, ChevronDown, Bot, Cpu, Zap } from "lucide-react";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { MessageThread } from "@/components/agent/message-thread";
import { AgentInput } from "@/components/agent/agent-input";
import { cn } from "@/lib/utils";

const AGENT_COLOR = "#4F46E5";

const MODES = [
  { id: "agent", label: "Agent", icon: Bot },
  { id: "ask", label: "Ask", icon: Sparkles },
] as const;

const MODELS = [
  { id: "caremap-pro", label: "CareMap Pro", icon: Zap },
  { id: "caremap-fast", label: "CareMap Fast", icon: Cpu },
] as const;

type ModeId = (typeof MODES)[number]["id"];
type ModelId = (typeof MODELS)[number]["id"];

export function AgentPanel() {
  const { projectId } = useActiveProject();
  const session = useAgentStore((s) => (projectId ? s.sessions[projectId] : null));
  const { addMessage } = useAgentStore();

  const [activeMode, setActiveMode] = useState<ModeId>("agent");
  const [activeModel, setActiveModel] = useState<ModelId>("caremap-pro");
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const inputRef = useRef<{ setDraft: (text: string) => void }>(null);

  const messages = session?.messages ?? [];
  const hasMessages = messages.length > 0;

  const currentMode = MODES.find((m) => m.id === activeMode)!;
  const currentModel = MODELS.find((m) => m.id === activeModel)!;

  function handleSend(text: string) {
    if (!projectId) return;
    addMessage(projectId, {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    });
  }

  function handleSuggestionClick(prompt: string) {
    inputRef.current?.setDraft(prompt);
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-cm-bg-app">
      {/* Conversation / empty state */}
      {hasMessages ? (
        <MessageThread messages={messages} agentColor={AGENT_COLOR} />
      ) : (
        <AgentEmptyState onSuggestionClick={handleSuggestionClick} />
      )}

      {/* Bottom: Input + selectors */}
      <div className="shrink-0 border-t border-cm-border-subtle px-3 pt-2.5 pb-2 space-y-1.5">
        <AgentInput
          ref={inputRef}
          placeholder="Ask anything about your data..."
          onSend={handleSend}
        />

        <div className="flex items-center gap-1">
          <SelectorButton
            mode={currentMode}
            isOpen={showModeMenu}
            onToggle={() => {
              setShowModeMenu((p) => !p);
              setShowModelMenu(false);
            }}
            items={MODES}
            activeId={activeMode}
            onSelect={(id) => {
              setActiveMode(id as ModeId);
              setShowModeMenu(false);
            }}
            onClose={() => setShowModeMenu(false)}
          />
          <SelectorButton
            mode={currentModel}
            isOpen={showModelMenu}
            onToggle={() => {
              setShowModelMenu((p) => !p);
              setShowModeMenu(false);
            }}
            items={MODELS}
            activeId={activeModel}
            onSelect={(id) => {
              setActiveModel(id as ModelId);
              setShowModelMenu(false);
            }}
            onClose={() => setShowModelMenu(false)}
          />
        </div>
      </div>
    </aside>
  );
}

/* ─── Empty state ─── */

function AgentEmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  const suggestions = [
    { label: "Profile a source file", prompt: "Profile the care_assessments.csv file and show me the data quality" },
    { label: "Map to canonical schema", prompt: "Map the uploaded source columns to our canonical schema" },
    { label: "Check data quality", prompt: "Show me all data quality issues across uploaded sources" },
    { label: "Explain an anomaly", prompt: "Explain the CRP anomaly spike in the lab results" },
  ];

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
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onSuggestionClick(s.prompt)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-cm-border-primary bg-white px-3 py-2.5 text-left text-xs text-cm-text-secondary transition-colors hover:bg-cm-bg-elevated hover:text-cm-text-primary"
          >
            <Sparkles className="h-3 w-3 text-cm-accent shrink-0" />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Selector button with dropdown ─── */

interface SelectorButtonProps {
  mode: { id: string; label: string; icon: React.ComponentType<{ className?: string }> };
  isOpen: boolean;
  onToggle: () => void;
  items: readonly { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function SelectorButton({ mode, isOpen, onToggle, items, activeId, onSelect, onClose }: SelectorButtonProps) {
  const Icon = mode.icon;

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-cm-text-secondary hover:bg-cm-bg-elevated transition-colors"
      >
        <Icon className="h-3 w-3" />
        {mode.label}
        <ChevronDown className="h-3 w-3 text-cm-text-tertiary" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <div className="absolute left-0 bottom-full z-40 mb-1 w-40 rounded-lg border border-cm-border-primary bg-white p-1 shadow-lg">
            {items.map((item) => {
              const ItemIcon = item.icon;
              const isActive = item.id === activeId;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                    isActive
                      ? "bg-cm-accent-subtle text-cm-accent font-medium"
                      : "text-cm-text-secondary hover:bg-cm-bg-elevated"
                  )}
                >
                  <ItemIcon className="h-3 w-3" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
