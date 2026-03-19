import { useState, useCallback } from "react";
import { MessageCircle, X, AlertTriangle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { MOCK_SOURCE_PREVIEWS, type SourcePreview } from "@/lib/mock-data";
import { EditableLabel } from "@/components/shared/editable-label";
import { SourceUploadZone } from "./source-upload-zone";
import { SourceAnalyzingState } from "./source-analyzing-state";
import { SourceDataTable } from "./source-data-table";
import { SourceSummaryBar } from "./source-summary-bar";
import { SourceAiPrompts } from "./source-ai-prompts";

type PanelPhase = "upload" | "analyzing" | "preview";

interface SourceDetailPanelProps {
  nodeId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolvePreviewId(nodeId: string, sourceFileId?: string): string | null {
  if (sourceFileId && MOCK_SOURCE_PREVIEWS[sourceFileId]) return sourceFileId;

  const fallbackMap: Record<string, string> = {
    "source-1": "src-001",
    "source-2": "src-002",
  };
  const mapped = fallbackMap[nodeId];
  if (mapped && MOCK_SOURCE_PREVIEWS[mapped]) return mapped;

  return null;
}

const ANALYSIS_DURATION_MS = 2400;

export function SourceDetailPanel({ nodeId }: SourceDetailPanelProps) {
  const { projectId } = useActiveProject();
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined
  );
  const selectNode = usePipelineStore((s) => s.selectNode);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const existingPreviewId = resolvePreviewId(nodeId, node?.data.sourceFileId);
  const hasExistingData = existingPreviewId !== null;

  const [phase, setPhase] = useState<PanelPhase>(hasExistingData ? "preview" : "upload");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);
  const [dynamicPreview, setDynamicPreview] = useState<SourcePreview | null>(null);
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);

  const preview = dynamicPreview
    ?? (existingPreviewId ? MOCK_SOURCE_PREVIEWS[existingPreviewId] : null);

  const handleFileSelected = useCallback(
    (file: File) => {
      if (!projectId) return;

      setUploadedFile({ name: file.name, size: formatFileSize(file.size) });
      setPhase("analyzing");

      updateNodeData(projectId, nodeId, {
        label: file.name,
        status: "running",
      });

      setTimeout(() => {
        const mockPreview = pickMockPreview(file.name);

        setDynamicPreview({
          ...mockPreview,
          filename: file.name,
        });

        updateNodeData(projectId, nodeId, {
          label: file.name.replace(/\.[^.]+$/, ""),
          status: "ready",
          rowCount: mockPreview.totalRows,
          columnCount: mockPreview.totalColumns,
          sourceFileId: mockPreview.sourceFileId,
        });

        setPhase("preview");
      }, ANALYSIS_DURATION_MS);
    },
    [projectId, nodeId, updateNodeData],
  );

  if (!node || !projectId) return null;

  const subtitle =
    phase === "preview" && preview
      ? `${preview.totalRows.toLocaleString()} rows · ${preview.totalColumns} columns`
      : phase === "analyzing"
        ? "Analyzing..."
        : "Source node — no data uploaded";

  const handleRename = useCallback(
    (newName: string) => {
      if (!projectId) return;
      updateNodeData(projectId, nodeId, { label: newName });
    },
    [projectId, nodeId, updateNodeData],
  );

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
          <p className="text-xs text-cm-text-tertiary mt-0.5">{subtitle}</p>
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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => selectNode(projectId, null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Upload state */}
      {phase === "upload" && (
        <div className="flex-1 overflow-y-auto p-4">
          <SourceUploadZone onFileSelected={handleFileSelected} />
        </div>
      )}

      {/* Analyzing state */}
      {phase === "analyzing" && uploadedFile && (
        <SourceAnalyzingState
          filename={uploadedFile.name}
          fileSize={uploadedFile.size}
        />
      )}

      {/* Preview state */}
      {phase === "preview" && preview && (
        <>
          <SourceSummaryBar preview={preview} />

          <div className="flex items-center justify-between border-b border-cm-border-primary px-4 py-2 shrink-0">
            <button
              onClick={() => setShowIssuesOnly(!showIssuesOnly)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                showIssuesOnly
                  ? "bg-cm-warning-subtle text-cm-warning"
                  : "bg-cm-bg-elevated text-cm-text-secondary hover:bg-cm-bg-hover"
              }`}
            >
              {showIssuesOnly ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Filter className="h-3 w-3" />
              )}
              {showIssuesOnly
                ? `${preview.issueCount} issues`
                : `Show ${preview.issueCount} issues`}
            </button>

            <span className="text-[10px] text-cm-text-tertiary">
              Showing {showIssuesOnly ? "columns with issues" : "all columns"}
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            <SourceDataTable preview={preview} showIssuesOnly={showIssuesOnly} />
          </div>

          <SourceAiPrompts preview={preview} />
        </>
      )}
    </div>
  );
}

function pickMockPreview(filename: string): SourcePreview {
  const lower = filename.toLowerCase();
  if (lower.includes("lab") || lower.includes("labor")) {
    return MOCK_SOURCE_PREVIEWS["src-002"];
  }
  return MOCK_SOURCE_PREVIEWS["src-001"];
}
