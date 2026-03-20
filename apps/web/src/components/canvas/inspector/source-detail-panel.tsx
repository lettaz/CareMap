import { useState, useCallback, useEffect } from "react";
import { MessageCircle, X, AlertTriangle, Filter, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { EditableLabel } from "@/components/shared/editable-label";
import { SourceUploadZone } from "./source-upload-zone";
import { SourceAnalyzingState } from "./source-analyzing-state";
import { uploadWithSSE } from "@/lib/api/sse";
import { fetchDetailedProfile, type DetailedProfileDTO } from "@/lib/api/ingest";

type PanelPhase = "upload" | "analyzing" | "preview";

interface SourceDetailPanelProps {
  nodeId: string;
}

interface AnalysisStep {
  label: string;
  status: "pending" | "running" | "completed" | "error";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SourceDetailPanel({ nodeId }: SourceDetailPanelProps) {
  const { projectId } = useActiveProject();
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined
  );
  const selectNode = usePipelineStore((s) => s.selectNode);
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);

  const hasExistingData = !!node?.data.sourceFileId && node?.data.status === "ready";

  const [phase, setPhase] = useState<PanelPhase>(hasExistingData ? "preview" : "upload");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [profile, setProfile] = useState<DetailedProfileDTO | null>(null);
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasExistingData && node?.data.sourceFileId && !profile) {
      fetchDetailedProfile(node.data.sourceFileId as string)
        .then(setProfile)
        .catch(() => {});
    }
  }, [hasExistingData, node?.data.sourceFileId, profile]);

  const handleFileSelected = useCallback(
    (file: File) => {
      if (!projectId) return;

      setUploadedFile({ name: file.name, size: formatFileSize(file.size) });
      setPhase("analyzing");
      setError(null);
      setSteps([
        { label: "Uploading file", status: "running" },
        { label: "Parsing columns", status: "pending" },
        { label: "Computing statistics", status: "pending" },
        { label: "AI interpretation", status: "pending" },
      ]);

      updateNodeData(projectId, nodeId, { label: file.name, status: "running" });

      uploadWithSSE(
        "/api/ingest",
        file,
        { projectId, nodeId },
        {
          onEvent: (type, data) => {
            const d = data as Record<string, unknown>;
            switch (type) {
              case "step": {
                const stepName = d.step as string;
                const stepStatus = d.status as string;
                setSteps((prev) =>
                  prev.map((s) => {
                    if (stepName.includes("parse") && s.label.includes("Parsing")) {
                      return { ...s, status: stepStatus === "completed" ? "completed" : "running" };
                    }
                    if (stepName.includes("stats") && s.label.includes("statistics")) {
                      return { ...s, status: stepStatus === "completed" ? "completed" : "running" };
                    }
                    if (stepName.includes("interpret") && s.label.includes("AI")) {
                      return { ...s, status: stepStatus === "completed" ? "completed" : "running" };
                    }
                    return s;
                  }),
                );
                break;
              }
              case "parse_complete": {
                setSteps((prev) =>
                  prev.map((s) =>
                    s.label.includes("Uploading") ? { ...s, status: "completed" }
                    : s.label.includes("Parsing") ? { ...s, status: "completed" }
                    : s
                  ),
                );
                break;
              }
              case "profile_complete": {
                const sourceFileId = d.sourceFileId as string;
                const rowCount = d.rowCount as number | undefined;
                const columnCount = d.columnCount as number | undefined;

                setSteps((prev) => prev.map((s) => ({ ...s, status: "completed" as const })));

                updateNodeData(projectId, nodeId, {
                  status: "ready",
                  rowCount: rowCount ?? (d.totalRows as number),
                  columnCount: columnCount ?? (d.totalColumns as number),
                  sourceFileId,
                  label: file.name.replace(/\.[^.]+$/, ""),
                });

                fetchDetailedProfile(sourceFileId)
                  .then((p) => {
                    setProfile(p);
                    setPhase("preview");
                  })
                  .catch(() => setPhase("preview"));
                break;
              }
              case "error": {
                setError(d.message as string ?? "Upload failed");
                setPhase("upload");
                updateNodeData(projectId, nodeId, { status: "error" });
                break;
              }
            }
          },
          onError: (err) => {
            setError(err.message);
            setPhase("upload");
            updateNodeData(projectId, nodeId, { status: "error" });
            toast.error("Upload failed", { description: err.message });
          },
          onDone: () => {
            setSteps((prev) => {
              const allDone = prev.every((s) => s.status === "completed");
              if (!allDone) return prev.map((s) => ({ ...s, status: "completed" as const }));
              return prev;
            });
            toast.success("File uploaded and profiled");
          },
        },
      );
    },
    [projectId, nodeId, updateNodeData],
  );

  if (!node || !projectId) return null;

  const subtitle =
    phase === "preview" && profile
      ? `${profile.rowCount.toLocaleString()} rows · ${profile.columnCount} columns`
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

  const issueCount = profile?.columns.filter(
    (c) => (c.nativeStats?.nullCount as number) > 0 || (c.nativeStats?.emptyCount as number) > 0
  ).length ?? 0;

  return (
    <div className="flex w-full flex-col overflow-hidden">
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

      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {phase === "upload" && (
        <div className="flex-1 overflow-y-auto p-4">
          <SourceUploadZone onFileSelected={handleFileSelected} />
        </div>
      )}

      {phase === "analyzing" && uploadedFile && (
        <SourceAnalyzingState
          filename={uploadedFile.name}
          fileSize={uploadedFile.size}
          steps={steps}
        />
      )}

      {phase === "preview" && profile && (
        <>
          <ProfileSummary profile={profile} />

          {issueCount > 0 && (
            <div className="flex items-center justify-between border-b border-cm-border-primary px-4 py-2 shrink-0">
              <button
                onClick={() => setShowIssuesOnly(!showIssuesOnly)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  showIssuesOnly
                    ? "bg-cm-warning-subtle text-cm-warning"
                    : "bg-cm-bg-elevated text-cm-text-secondary hover:bg-cm-bg-hover"
                }`}
              >
                {showIssuesOnly ? <AlertTriangle className="h-3 w-3" /> : <Filter className="h-3 w-3" />}
                {showIssuesOnly ? `${issueCount} issues` : `Show ${issueCount} issues`}
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <ProfileTable profile={profile} showIssuesOnly={showIssuesOnly} />
          </div>
        </>
      )}

      {phase === "preview" && !profile && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-cm-accent" />
        </div>
      )}
    </div>
  );
}

function ProfileSummary({ profile }: { profile: DetailedProfileDTO }) {
  return (
    <div className="grid grid-cols-3 gap-px border-b border-cm-border-primary bg-cm-border-primary">
      {[
        { label: "Rows", value: profile.rowCount.toLocaleString() },
        { label: "Columns", value: profile.columnCount.toString() },
        { label: "Status", value: profile.status },
      ].map((item) => (
        <div key={item.label} className="bg-cm-bg-surface px-3 py-2">
          <p className="text-[10px] font-medium text-cm-text-tertiary uppercase">{item.label}</p>
          <p className="text-sm font-semibold text-cm-text-primary">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function ProfileTable({
  profile,
  showIssuesOnly,
}: {
  profile: DetailedProfileDTO;
  showIssuesOnly: boolean;
}) {
  const columns = showIssuesOnly
    ? profile.columns.filter(
        (c) => (c.nativeStats?.nullCount as number) > 0 || (c.nativeStats?.emptyCount as number) > 0
      )
    : profile.columns;

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-cm-bg-elevated">
        <tr>
          <th className="px-3 py-2 text-left font-medium text-cm-text-secondary">Column</th>
          <th className="px-3 py-2 text-left font-medium text-cm-text-secondary">Type</th>
          <th className="px-3 py-2 text-left font-medium text-cm-text-secondary">Label</th>
          <th className="px-3 py-2 text-right font-medium text-cm-text-secondary">Nulls</th>
        </tr>
      </thead>
      <tbody>
        {columns.map((col) => {
          const llm = col.llmInterpretation as Record<string, unknown> | undefined;
          const stats = col.nativeStats as Record<string, unknown> | undefined;
          return (
            <tr key={col.columnName} className="border-t border-cm-border-subtle">
              <td className="px-3 py-1.5 font-mono text-cm-text-primary">{col.columnName}</td>
              <td className="px-3 py-1.5 text-cm-text-tertiary">{String(stats?.inferredType ?? "")}</td>
              <td className="px-3 py-1.5 text-cm-text-secondary">{String(llm?.semanticLabel ?? "")}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-cm-text-tertiary">
                {String(stats?.nullCount ?? 0)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
