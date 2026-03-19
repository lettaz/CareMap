import { useState, useCallback, useMemo } from "react";
import {
  MessageCircle,
  X,
  Check,
  XCircle,
  ArrowRight,
  Filter,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { EditableLabel } from "@/components/shared/editable-label";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { MOCK_MAPPINGS } from "@/lib/mock-data";
import type { FieldMapping, MappingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MappingDetailPanelProps {
  nodeId: string;
}

type FilterMode = "all" | "issues";

const STATUS_BADGE: Record<MappingStatus, { label: string; bg: string; text: string; icon: typeof Check }> = {
  accepted: { label: "Auto", bg: "bg-cm-success-subtle", text: "text-cm-success", icon: Check },
  pending: { label: "Review", bg: "bg-cm-warning-subtle", text: "text-cm-warning", icon: Filter },
  rejected: { label: "Unmapped", bg: "bg-cm-error-subtle", text: "text-cm-error", icon: XCircle },
};

function getMappingsForNode(nodeId: string): FieldMapping[] {
  if (nodeId === "mapping-1") return MOCK_MAPPINGS;
  return MOCK_MAPPINGS;
}

export function MappingDetailPanel({ nodeId }: MappingDetailPanelProps) {
  const { projectId } = useActiveProject();
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined
  );
  const selectNode = usePipelineStore((s) => s.selectNode);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const [mappings, setMappings] = useState(() => getMappingsForNode(nodeId));
  const [filter, setFilter] = useState<FilterMode>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRename = useCallback(
    (newName: string) => {
      if (!projectId) return;
      updateNodeData(projectId, nodeId, { label: newName });
    },
    [projectId, nodeId, updateNodeData],
  );

  const updateStatus = useCallback((id: string, status: MappingStatus) => {
    setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }, []);

  const acceptAllHighConfidence = useCallback(() => {
    setMappings((prev) =>
      prev.map((m) =>
        m.status === "pending" && m.confidence >= 0.75
          ? { ...m, status: "accepted" }
          : m
      )
    );
  }, []);

  const stats = useMemo(() => {
    const auto = mappings.filter((m) => m.status === "accepted").length;
    const review = mappings.filter((m) => m.status === "pending").length;
    const unmapped = mappings.filter((m) => m.status === "rejected").length;
    const avgConfidence = mappings.reduce((s, m) => s + m.confidence, 0) / mappings.length;
    return { auto, review, unmapped, total: mappings.length, avgConfidence };
  }, [mappings]);

  const visibleMappings = filter === "issues"
    ? mappings.filter((m) => m.status !== "accepted")
    : mappings;

  if (!node || !projectId) return null;

  return (
    <div className="flex w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cm-border-primary px-4 py-3 shrink-0">
        <div className="min-w-0 flex-1">
          <EditableLabel
            value={node.data.label}
            onCommit={handleRename}
            className="text-sm font-medium text-cm-text-primary"
          />
          <p className="text-xs text-cm-text-tertiary mt-0.5">
            {stats.total} fields · {stats.auto} mapped · {stats.review + stats.unmapped} need attention
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => selectNode(projectId, null)}
            title="Back to Chat"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => selectNode(projectId, null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="border-b border-cm-border-primary px-4 py-3 space-y-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <ConfidenceBar value={stats.avgConfidence} />
          <span className="text-xs font-medium text-cm-text-primary whitespace-nowrap">
            {Math.round(stats.avgConfidence * 100)}% avg
          </span>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-cm-success-subtle px-2 py-0.5 text-[10px] font-medium text-cm-success">
            <Check className="h-2.5 w-2.5" /> {stats.auto} auto
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-cm-warning-subtle px-2 py-0.5 text-[10px] font-medium text-cm-warning">
            {stats.review} review
          </span>
          {stats.unmapped > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cm-error-subtle px-2 py-0.5 text-[10px] font-medium text-cm-error">
              {stats.unmapped} unmapped
            </span>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between border-b border-cm-border-primary px-4 py-2 shrink-0">
        <button
          onClick={() => setFilter(filter === "all" ? "issues" : "all")}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            filter === "issues"
              ? "bg-cm-warning-subtle text-cm-warning"
              : "bg-cm-bg-elevated text-cm-text-secondary hover:bg-cm-bg-hover"
          )}
        >
          <Filter className="h-3 w-3" />
          {filter === "issues" ? "Showing issues only" : "Show issues only"}
        </button>

        {stats.review > 0 && (
          <button
            onClick={acceptAllHighConfidence}
            className="flex items-center gap-1 rounded-md bg-cm-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-cm-accent-hover transition-colors"
          >
            <Zap className="h-3 w-3" />
            Auto-accept high confidence
          </button>
        )}
      </div>

      {/* Mapping table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-cm-bg-elevated">
              <th className="border-b border-r border-cm-border-primary px-3 py-2 text-left text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide">
                Source Field
              </th>
              <th className="border-b border-r border-cm-border-primary px-3 py-2 text-left text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide">
                Sample
              </th>
              <th className="border-b border-r border-cm-border-primary px-3 py-2 text-left text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide">
                Target Mapping
              </th>
              <th className="border-b border-r border-cm-border-primary px-2 py-2 text-center text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide w-[70px]">
                Confidence
              </th>
              <th className="border-b border-cm-border-primary px-2 py-2 text-center text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide w-[80px]">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleMappings.map((mapping, idx) => {
              const badge = STATUS_BADGE[mapping.status];
              const BadgeIcon = badge.icon;
              const isExpanded = expandedId === mapping.id;

              return (
                <MappingRow
                  key={mapping.id}
                  mapping={mapping}
                  badge={badge}
                  BadgeIcon={BadgeIcon}
                  isExpanded={isExpanded}
                  isEven={idx % 2 === 0}
                  onToggleExpand={() => setExpandedId(isExpanded ? null : mapping.id)}
                  onAccept={() => updateStatus(mapping.id, "accepted")}
                  onReject={() => updateStatus(mapping.id, "rejected")}
                  onReset={() => updateStatus(mapping.id, "pending")}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* AI prompts */}
      <MappingAiPrompts issueCount={stats.review + stats.unmapped} />
    </div>
  );
}

/* ─── Row component ─── */

interface MappingRowProps {
  mapping: FieldMapping;
  badge: (typeof STATUS_BADGE)[MappingStatus];
  BadgeIcon: typeof Check;
  isExpanded: boolean;
  isEven: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onReset: () => void;
}

function MappingRow({
  mapping,
  badge,
  BadgeIcon,
  isExpanded,
  isEven,
  onToggleExpand,
  onAccept,
  onReject,
  onReset,
}: MappingRowProps) {
  return (
    <>
      <tr
        className={cn(
          "border-b border-cm-border-subtle transition-colors hover:bg-cm-bg-elevated/50 cursor-pointer",
          isEven ? "bg-white" : "bg-cm-bg-app",
          mapping.status === "pending" && "bg-cm-warning-subtle/20",
          mapping.status === "rejected" && "bg-cm-error-subtle/20",
        )}
        onClick={onToggleExpand}
      >
        <td className="border-r border-cm-border-subtle px-3 py-2">
          <div className="flex items-center gap-1.5">
            {isExpanded ? (
              <ChevronUp className="h-3 w-3 text-cm-text-tertiary shrink-0" />
            ) : (
              <ChevronDown className="h-3 w-3 text-cm-text-tertiary shrink-0" />
            )}
            <span className="font-mono text-[11px] font-medium text-cm-text-primary truncate">
              {mapping.sourceColumn}
            </span>
          </div>
        </td>
        <td className="border-r border-cm-border-subtle px-3 py-2">
          <span className="font-mono text-[11px] text-cm-text-secondary truncate block max-w-[100px]" title={mapping.sampleValue}>
            {mapping.sampleValue ?? "—"}
          </span>
        </td>
        <td className="border-r border-cm-border-subtle px-3 py-2">
          {mapping.status === "rejected" ? (
            <span className="text-[11px] text-cm-text-tertiary italic">???</span>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-mono text-[11px] text-cm-accent truncate">
                {mapping.targetTable}
              </span>
              <ArrowRight className="h-2.5 w-2.5 text-cm-text-tertiary shrink-0" />
              <span className="font-mono text-[11px] text-cm-text-primary truncate">
                {mapping.targetColumn}
              </span>
            </div>
          )}
        </td>
        <td className="border-r border-cm-border-subtle px-2 py-2 text-center">
          <span className={cn(
            "text-[11px] font-medium tabular-nums",
            mapping.confidence >= 0.8 ? "text-cm-success" :
            mapping.confidence >= 0.6 ? "text-cm-warning" :
            "text-cm-error"
          )}>
            {Math.round(mapping.confidence * 100)}%
          </span>
        </td>
        <td className="px-2 py-2 text-center">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
            badge.bg, badge.text
          )}>
            <BadgeIcon className="h-2.5 w-2.5" />
            {badge.label}
          </span>
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr className="bg-cm-bg-elevated/50">
          <td colSpan={5} className="border-b border-cm-border-subtle px-4 py-3">
            <div className="space-y-2.5">
              {/* Reasoning */}
              <div className="flex gap-2">
                <Sparkles className="h-3 w-3 text-cm-accent shrink-0 mt-0.5" />
                <p className="text-[11px] text-cm-text-secondary leading-relaxed">
                  {mapping.reasoning}
                </p>
              </div>

              {/* Transformation */}
              {mapping.transformation && (
                <div className="rounded bg-cm-bg-app border border-cm-border-subtle px-2.5 py-1.5">
                  <p className="text-[9px] font-medium text-cm-text-tertiary uppercase tracking-wide mb-0.5">Transform</p>
                  <code className="text-[10px] font-mono text-cm-text-primary">{mapping.transformation}</code>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-1.5 pt-0.5">
                {mapping.status !== "accepted" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAccept(); }}
                    className="flex items-center gap-1 rounded bg-cm-success-subtle px-2.5 py-1 text-[10px] font-medium text-cm-success hover:bg-cm-success/10 transition-colors"
                  >
                    <Check className="h-3 w-3" /> Accept
                  </button>
                )}
                {mapping.status !== "rejected" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onReject(); }}
                    className="flex items-center gap-1 rounded bg-cm-error-subtle px-2.5 py-1 text-[10px] font-medium text-cm-error hover:bg-cm-error/10 transition-colors"
                  >
                    <XCircle className="h-3 w-3" /> Reject
                  </button>
                )}
                {mapping.status !== "pending" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onReset(); }}
                    className="flex items-center gap-1 rounded bg-cm-bg-elevated px-2.5 py-1 text-[10px] font-medium text-cm-text-secondary hover:bg-cm-bg-hover transition-colors"
                  >
                    Reset to Review
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── AI prompts ─── */

function MappingAiPrompts({ issueCount }: { issueCount: number }) {
  const suggestions = [
    "Review low-confidence fields",
    "Show all missing mandatory identifiers",
    "Suggest target mappings for unmapped columns",
    ...(issueCount > 0 ? ["Resolve all issues automatically"] : []),
  ];

  return (
    <div className="shrink-0 border-t border-cm-border-primary bg-cm-bg-surface px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-cm-accent" />
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
