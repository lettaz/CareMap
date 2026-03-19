import { useState, useMemo } from "react";
import {
  MessageCircle,
  X,
  Check,
  XCircle,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Link2,
  Database,
  ArrowLeftRight,
  Zap,
  CircleDot,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { EditableLabel } from "@/components/shared/editable-label";
import { MOCK_TARGET_TABLES, MOCK_ORPHAN_COLUMNS, MOCK_JOIN_KEYS } from "@/lib/mock-data";
import { MOCK_SOURCES } from "@/lib/mock-data";
import type { TargetTableMapping, TargetColumn, JoinKey, TargetColumnStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MappingDetailPanelProps {
  nodeId: string;
}

type TabId = string | "joins" | "orphans";

const STATUS_CONFIG: Record<TargetColumnStatus, { icon: typeof Check; color: string; bg: string; label: string }> = {
  mapped: { icon: Check, color: "text-cm-success", bg: "bg-cm-success-subtle", label: "Mapped" },
  partial: { icon: AlertTriangle, color: "text-cm-warning", bg: "bg-cm-warning-subtle", label: "Review" },
  gap: { icon: XCircle, color: "text-cm-error", bg: "bg-cm-error-subtle", label: "Gap" },
  derived: { icon: Sparkles, color: "text-cm-accent", bg: "bg-cm-accent-subtle", label: "Derived" },
};

function getSourceFilename(sourceFileId: string): string {
  return MOCK_SOURCES.find((s) => s.id === sourceFileId)?.filename ?? sourceFileId;
}

function getTableStats(table: TargetTableMapping) {
  let mapped = 0, issues = 0, total = table.columns.length;
  for (const c of table.columns) {
    if (c.status === "mapped" || c.status === "derived") mapped++;
    if (c.status === "gap" || c.status === "partial") issues++;
  }
  return { mapped, issues, total };
}

export function MappingDetailPanel({ nodeId }: MappingDetailPanelProps) {
  const { projectId } = useActiveProject();
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined,
  );
  const selectNode = usePipelineStore((s) => s.selectNode);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const [activeTab, setActiveTab] = useState<TabId>(MOCK_TARGET_TABLES[0]?.targetTable ?? "");
  const [expandedCol, setExpandedCol] = useState<string | null>(null);

  const globalStats = useMemo(() => {
    let mapped = 0, partial = 0, gaps = 0, derived = 0;
    for (const t of MOCK_TARGET_TABLES) {
      for (const c of t.columns) {
        if (c.status === "mapped") mapped++;
        else if (c.status === "partial") partial++;
        else if (c.status === "gap") gaps++;
        else if (c.status === "derived") derived++;
      }
    }
    const total = mapped + partial + gaps + derived;
    return { mapped, partial, gaps, derived, total, orphans: MOCK_ORPHAN_COLUMNS.length };
  }, []);

  if (!node || !projectId) return null;

  const activeTable = MOCK_TARGET_TABLES.find((t) => t.targetTable === activeTab);

  return (
    <div className="flex w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cm-border-primary px-4 py-3 shrink-0">
        <div className="min-w-0 flex-1">
          <EditableLabel
            value={node.data.label}
            onCommit={(v) => updateNodeData(projectId, nodeId, { label: v })}
            className="text-sm font-medium text-cm-text-primary"
          />
          <p className="text-xs text-cm-text-tertiary mt-0.5">
            {MOCK_TARGET_TABLES.length} target tables · {globalStats.total} columns · {globalStats.gaps + globalStats.partial + globalStats.orphans} need attention
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => selectNode(projectId, null)} title="Back to Chat">
            <MessageCircle className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => selectNode(projectId, null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Global summary */}
      <div className="flex items-center gap-2 border-b border-cm-border-primary px-4 py-2.5 shrink-0 flex-wrap">
        <StatBadge icon={Check} color="text-cm-success" bg="bg-cm-success-subtle" count={globalStats.mapped} label="mapped" />
        <StatBadge icon={Sparkles} color="text-cm-accent" bg="bg-cm-accent-subtle" count={globalStats.derived} label="derived" />
        {globalStats.partial > 0 && (
          <StatBadge icon={AlertTriangle} color="text-cm-warning" bg="bg-cm-warning-subtle" count={globalStats.partial} label="review" />
        )}
        {globalStats.gaps > 0 && (
          <StatBadge icon={XCircle} color="text-cm-error" bg="bg-cm-error-subtle" count={globalStats.gaps} label="gaps" />
        )}
        {globalStats.orphans > 0 && (
          <StatBadge icon={CircleDot} color="text-cm-text-tertiary" bg="bg-cm-bg-elevated" count={globalStats.orphans} label="orphan" />
        )}
      </div>

      {/* Target table tabs */}
      <div className="flex items-center gap-0.5 border-b border-cm-border-primary px-2 overflow-x-auto scrollbar-none shrink-0">
        {MOCK_TARGET_TABLES.map((t) => {
          const tableStats = getTableStats(t);
          return (
            <TabButton
              key={t.targetTable}
              active={activeTab === t.targetTable}
              onClick={() => { setActiveTab(t.targetTable); setExpandedCol(null); }}
              icon={<Database className="h-3 w-3" />}
              label={t.label}
              badge={tableStats.issues > 0 ? tableStats.issues : undefined}
            />
          );
        })}
        <TabButton
          active={activeTab === "joins"}
          onClick={() => { setActiveTab("joins"); setExpandedCol(null); }}
          icon={<Link2 className="h-3 w-3" />}
          label="Joins"
          badge={MOCK_JOIN_KEYS.length}
        />
        {MOCK_ORPHAN_COLUMNS.length > 0 && (
          <TabButton
            active={activeTab === "orphans"}
            onClick={() => { setActiveTab("orphans"); setExpandedCol(null); }}
            icon={<CircleDot className="h-3 w-3" />}
            label="Orphans"
            badge={MOCK_ORPHAN_COLUMNS.length}
          />
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTable && (
          <TargetTableView
            table={activeTable}
            expandedCol={expandedCol}
            onToggleCol={(col) => setExpandedCol(expandedCol === col ? null : col)}
          />
        )}
        {activeTab === "joins" && <JoinsView joins={MOCK_JOIN_KEYS} />}
        {activeTab === "orphans" && <OrphansView />}
      </div>

      {/* AI suggestions */}
      <MappingAiPrompts activeTab={activeTab} />
    </div>
  );
}

/* ─── Target Table View ─── */

function TargetTableView({
  table,
  expandedCol,
  onToggleCol,
}: {
  table: TargetTableMapping;
  expandedCol: string | null;
  onToggleCol: (col: string) => void;
}) {
  const stats = getTableStats(table);

  return (
    <div>
      {/* Table header */}
      <div className="px-4 py-3 border-b border-cm-border-subtle bg-cm-bg-app/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-cm-node-transform" />
            <span className="text-xs font-mono font-medium text-cm-text-primary">{table.targetTable}</span>
          </div>
          <CompletionBadge mapped={stats.mapped} total={stats.total} />
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-cm-text-tertiary">
            Sources: {table.sourceFileIds.map(getSourceFilename).join(", ")}
          </span>
        </div>
      </div>

      {/* Column list */}
      {table.columns.map((col) => (
        <TargetColumnRow
          key={col.column}
          col={col}
          isExpanded={expandedCol === col.column}
          onToggle={() => onToggleCol(col.column)}
        />
      ))}
    </div>
  );
}

function TargetColumnRow({
  col,
  isExpanded,
  onToggle,
}: {
  col: TargetColumn;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const cfg = STATUS_CONFIG[col.status];
  const StatusIcon = cfg.icon;
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div className={cn("border-b border-cm-border-subtle", col.status === "gap" && "bg-cm-error-subtle/10")}>
      <button onClick={onToggle} className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-cm-bg-elevated/50 transition-colors">
        <Chevron className="h-3 w-3 text-cm-text-tertiary shrink-0" />

        {/* Column name + type */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-medium text-cm-text-primary">{col.column}</span>
            {col.required && <span className="text-[8px] font-bold text-cm-error uppercase">req</span>}
            <span className="text-[10px] text-cm-text-tertiary">{col.dataType}</span>
          </div>
          <p className="text-[10px] text-cm-text-tertiary truncate mt-0.5">{col.description}</p>
        </div>

        {/* Source mapping preview */}
        <div className="shrink-0 flex items-center gap-1.5">
          {col.sourceMapping && (
            <span className="font-mono text-[10px] text-cm-text-secondary truncate max-w-[100px]">
              ← {col.sourceMapping.sourceColumn}
            </span>
          )}
          {col.status === "derived" && (
            <span className="text-[10px] text-cm-accent italic">auto</span>
          )}
          {col.status === "gap" && (
            <span className="text-[10px] text-cm-error italic">missing</span>
          )}
        </div>

        {/* Status badge */}
        <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium shrink-0", cfg.bg, cfg.color)}>
          <StatusIcon className="h-2.5 w-2.5" />
          {cfg.label}
        </span>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-0 ml-5">
          {col.sourceMapping && <SourceMappingDetail mapping={col.sourceMapping} />}
          {col.derivedValue && (
            <div className="flex items-start gap-2 mt-1">
              <Sparkles className="h-3 w-3 text-cm-accent shrink-0 mt-0.5" />
              <p className="text-[11px] text-cm-text-secondary leading-relaxed">{col.derivedValue}</p>
            </div>
          )}
          {col.status === "gap" && (
            <div className="flex items-start gap-2 mt-1 rounded bg-cm-error-subtle/30 border border-cm-error/10 px-2.5 py-2">
              <XCircle className="h-3 w-3 text-cm-error shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-cm-error">No source column available</p>
                <p className="text-[10px] text-cm-text-tertiary mt-0.5">
                  {col.required ? "This is a required field. Ask AI to suggest a derivation or mark as nullable." : "Optional field. Can be left null."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SourceMappingDetail({ mapping }: { mapping: NonNullable<TargetColumn["sourceMapping"]> }) {
  return (
    <div className="space-y-2">
      {/* Source reference */}
      <div className="flex items-center gap-2 rounded bg-cm-bg-app border border-cm-border-subtle px-2.5 py-2">
        <FileSpreadsheet className="h-3 w-3 text-cm-text-tertiary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] font-medium text-cm-text-primary">{mapping.sourceColumn}</span>
            <ArrowLeftRight className="h-2.5 w-2.5 text-cm-text-tertiary" />
            <span className="text-[10px] text-cm-text-tertiary">{getSourceFilename(mapping.sourceFileId)}</span>
          </div>
          {mapping.sampleValue && (
            <span className="text-[10px] text-cm-text-tertiary">Sample: <span className="font-mono">{mapping.sampleValue}</span></span>
          )}
        </div>
        <ConfidencePill value={mapping.confidence} />
      </div>

      {/* AI reasoning */}
      <div className="flex items-start gap-2">
        <Sparkles className="h-3 w-3 text-cm-accent shrink-0 mt-0.5" />
        <p className="text-[11px] text-cm-text-secondary leading-relaxed">{mapping.reasoning}</p>
      </div>

      {/* Transformation */}
      {mapping.transformation && (
        <div className="rounded bg-cm-bg-app border border-cm-border-subtle px-2.5 py-1.5">
          <p className="text-[9px] font-medium text-cm-text-tertiary uppercase tracking-wide mb-0.5">Transform</p>
          <code className="text-[10px] font-mono text-cm-text-primary">{mapping.transformation}</code>
        </div>
      )}

      {/* Review actions */}
      {mapping.mappingStatus === "pending" && (
        <div className="flex gap-1.5">
          <button className="flex items-center gap-1 rounded bg-cm-success-subtle px-2.5 py-1 text-[10px] font-medium text-cm-success hover:bg-cm-success/10 transition-colors">
            <Check className="h-3 w-3" /> Accept
          </button>
          <button className="flex items-center gap-1 rounded bg-cm-error-subtle px-2.5 py-1 text-[10px] font-medium text-cm-error hover:bg-cm-error/10 transition-colors">
            <XCircle className="h-3 w-3" /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Joins View ─── */

function JoinsView({ joins }: { joins: JoinKey[] }) {
  return (
    <div className="px-4 py-3 space-y-2">
      <p className="text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide">
        Detected relationships ({joins.length})
      </p>
      {joins.map((j, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-cm-border-primary bg-white px-3 py-2.5">
          <Link2 className="h-3.5 w-3.5 text-cm-node-transform shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-[11px]">
              <span className="font-mono font-medium text-cm-accent">{j.fromTable}</span>
              <span className="text-cm-text-tertiary">.{j.fromColumn}</span>
              <ArrowLeftRight className="h-2.5 w-2.5 text-cm-text-tertiary mx-0.5" />
              <span className="font-mono font-medium text-cm-accent">{j.toTable}</span>
              <span className="text-cm-text-tertiary">.{j.toColumn}</span>
            </div>
            <p className="text-[10px] text-cm-text-tertiary mt-0.5">via source column: <span className="font-mono">{j.sharedSourceColumn}</span></p>
          </div>
          <ConfidencePill value={j.confidence} />
        </div>
      ))}
    </div>
  );
}

/* ─── Orphans View ─── */

function OrphansView() {
  return (
    <div className="px-4 py-3 space-y-2">
      <p className="text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide">
        Source columns with no target ({MOCK_ORPHAN_COLUMNS.length})
      </p>
      {MOCK_ORPHAN_COLUMNS.map((o, i) => (
        <div key={i} className="rounded-lg border border-cm-border-primary bg-white px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircleDot className="h-3.5 w-3.5 text-cm-text-tertiary" />
              <span className="font-mono text-[11px] font-medium text-cm-text-primary">{o.sourceColumn}</span>
              <span className="text-[10px] text-cm-text-tertiary">from {getSourceFilename(o.sourceFileId)}</span>
            </div>
            <ConfidencePill value={o.confidence} />
          </div>
          <p className="text-[10px] text-cm-text-tertiary mt-1.5 ml-5">{o.reasoning}</p>
          {o.sampleValue && (
            <p className="text-[10px] text-cm-text-tertiary mt-0.5 ml-5">Sample: <span className="font-mono">{o.sampleValue}</span></p>
          )}
          <div className="flex gap-1.5 mt-2 ml-5">
            <button className="rounded-full border border-cm-border-primary bg-white px-2.5 py-1 text-[10px] text-cm-text-secondary hover:bg-cm-bg-elevated transition-colors">
              Suggest target
            </button>
            <button className="rounded-full border border-cm-border-primary bg-white px-2.5 py-1 text-[10px] text-cm-text-secondary hover:bg-cm-bg-elevated transition-colors">
              Discard
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Shared Components ─── */

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 whitespace-nowrap px-2.5 py-2 text-[11px] font-medium border-b-2 transition-colors",
        active
          ? "border-cm-accent text-cm-accent"
          : "border-transparent text-cm-text-tertiary hover:text-cm-text-secondary",
      )}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className={cn(
          "ml-0.5 inline-flex items-center justify-center rounded-full px-1 min-w-[14px] h-3.5 text-[8px] font-bold",
          active ? "bg-cm-accent text-white" : "bg-cm-bg-elevated text-cm-text-tertiary",
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatBadge({ icon: Icon, color, bg, count, label }: { icon: typeof Check; color: string; bg: string; count: number; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", bg, color)}>
      <Icon className="h-2.5 w-2.5" /> {count} {label}
    </span>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className={cn(
      "text-[10px] font-medium tabular-nums shrink-0",
      pct >= 80 ? "text-cm-success" : pct >= 60 ? "text-cm-warning" : "text-cm-error",
    )}>
      {pct}%
    </span>
  );
}

function CompletionBadge({ mapped, total }: { mapped: number; total: number }) {
  const pct = total > 0 ? Math.round((mapped / total) * 100) : 0;
  return (
    <span className={cn(
      "text-[10px] font-medium",
      pct >= 80 ? "text-cm-success" : pct >= 50 ? "text-cm-warning" : "text-cm-error",
    )}>
      {mapped}/{total} covered
    </span>
  );
}

/* ─── AI Suggestions ─── */

function MappingAiPrompts({ activeTab }: { activeTab: TabId }) {
  const baseSuggestions = [
    "Resolve all gaps automatically",
    "Validate transformations",
  ];

  const contextSuggestions: Record<string, string[]> = {
    joins: ["Detect additional join paths", "Validate entity resolution"],
    orphans: ["Suggest targets for orphan columns", "Discard all low-confidence orphans"],
  };

  const suggestions = contextSuggestions[activeTab] ?? [
    `Fill gaps in ${activeTab}`,
    "Auto-accept high confidence mappings",
    ...baseSuggestions,
  ];

  return (
    <div className="shrink-0 border-t border-cm-border-primary bg-cm-bg-surface px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Zap className="h-3 w-3 text-cm-accent" />
        <span className="text-[10px] font-medium text-cm-text-tertiary">AI suggestions</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            className="rounded-full border border-cm-border-primary bg-white px-2.5 py-1 text-[11px] text-cm-text-secondary hover:bg-cm-bg-elevated hover:text-cm-text-primary transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
