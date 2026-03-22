import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  MessageCircle, X, AlertTriangle, Filter, Loader2,
  Database, Server, Globe, Clock, Lock, Sparkles, CheckCircle2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Pin, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { EditableLabel } from "@/components/shared/editable-label";
import { SourceUploadZone } from "./source-upload-zone";
import { SourceAnalyzingState } from "./source-analyzing-state";
import { SourceDataTable } from "./source-data-table";
import { SourceSummaryBar } from "./source-summary-bar";
import { WebhookConfigPanel } from "./webhook-config-panel";
import { uploadWithSSE } from "@/lib/api/sse";
import {
  fetchDetailedProfile,
  fetchSampleRows,
  type DetailedProfileDTO,
} from "@/lib/api/ingest";
import type { SourcePreview, SourcePreviewColumn } from "@/lib/types";

type PanelPhase = "upload" | "analyzing" | "preview";
type DataView = "original" | "cleaned";

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
  const notifySourceReady = usePipelineStore((s) => s.notifySourceReady);

  const nodeStatus = node?.data.status as string | undefined;
  const hasExistingData = !!node?.data.sourceFileId && (nodeStatus === "ready" || nodeStatus === "clean");
  const sourceFileId = node?.data.sourceFileId as string | undefined;
  const cleanedAt = node?.data.cleanedAt as number | undefined;

  const [phase, setPhase] = useState<PanelPhase>(hasExistingData ? "preview" : "upload");
  const [backendCleanStatus, setBackendCleanStatus] = useState(false);
  const hasCleanedVersion = !!(node?.data.hasCleanedVersion) || nodeStatus === "clean" || backendCleanStatus;
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [profile, setProfile] = useState<DetailedProfileDTO | null>(null);
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[] | null>(null);
  const [cleanedSampleRows, setCleanedSampleRows] = useState<Record<string, unknown>[] | null>(null);
  const [cleanedTotal, setCleanedTotal] = useState<number | null>(null);
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceTab, setSourceTab] = useState<"data" | "ingestion">("data");
  const [dataView, setDataView] = useState<DataView>("original");
  const prevNodeId = useRef(nodeId);

  useEffect(() => {
    if (prevNodeId.current !== nodeId) {
      prevNodeId.current = nodeId;
      setProfile(null);
      setSampleRows(null);
      setCleanedSampleRows(null);
      setCleanedTotal(null);
      setShowIssuesOnly(false);
      setError(null);
      setDataView("original");
      setPhase(hasExistingData ? "preview" : "upload");
    }
  }, [nodeId, hasExistingData]);

  useEffect(() => {
    if (!hasCleanedVersion || !sourceFileId || dataView !== "cleaned") return;
    if (cleanedSampleRows) return;

    fetchSampleRows(sourceFileId, { page: 1, pageSize: 50 }, "cleaned")
      .then((res) => {
        setCleanedSampleRows(res.data as Record<string, unknown>[]);
        setCleanedTotal(res.total);
      })
      .catch(() => setCleanedSampleRows([]));
  }, [hasCleanedVersion, sourceFileId, dataView, cleanedSampleRows]);

  useEffect(() => {
    if (!hasExistingData || !sourceFileId) return;
    if (profile?.sourceFileId === sourceFileId) return;

    fetchDetailedProfile(sourceFileId)
      .then((p) => {
        setProfile(p);
        if (p.status === "clean") {
          setBackendCleanStatus(true);
          if (projectId) {
            updateNodeData(projectId, nodeId, { hasCleanedVersion: true, status: "clean" });
          }
        }
        if (projectId) {
          const issueCount = p.columns.filter((c) => {
            const stats = c.nativeStats as Record<string, unknown>;
            return Number(stats?.nullCount ?? 0) / p.rowCount > 0.1;
          }).length;
          updateNodeData(projectId, nodeId, { issueCount });
        }
      })
      .catch(() => {});

    fetchSampleRows(sourceFileId, { page: 1, pageSize: 20 })
      .then((res) => setSampleRows(res.data))
      .catch(() => setSampleRows([]));
  }, [hasExistingData, sourceFileId, profile?.sourceFileId, projectId, nodeId, updateNodeData]);

  const prevCleanedAtRef = useRef(cleanedAt);
  useEffect(() => {
    if (!cleanedAt || cleanedAt === prevCleanedAtRef.current) return;
    prevCleanedAtRef.current = cleanedAt;
    setCleanedSampleRows(null);
    setCleanedTotal(null);
    setDataView("cleaned");
  }, [cleanedAt]);

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

      let capturedSourceFileId = "";
      let capturedRowCount = 0;
      let capturedColumnCount = 0;

      uploadWithSSE(
        "/api/ingest",
        file,
        { projectId, nodeId },
        {
          onEvent: (_evtType, data) => {
            const d = data as Record<string, unknown>;
            const type = (d.type as string) ?? _evtType;
            const inner = (d.data as Record<string, unknown>) ?? d;

            switch (type) {
              case "step": {
                const stepName = (inner.stepType ?? inner.step) as string;
                const stepStatus = inner.status as string;
                setSteps((prev) =>
                  prev.map((s) => {
                    if (stepName.includes("parse") && s.label.includes("Parsing")) {
                      return { ...s, status: stepStatus === "completed" ? "completed" : "running" };
                    }
                    if (stepName.includes("save") && s.label.includes("AI")) {
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
                const parsedSfId = inner.sourceFileId as string | undefined;
                const parsedRowCount = inner.rowCount as number | undefined;
                const parsedColCount = (inner.columns as string[] | undefined)?.length;
                if (parsedSfId) capturedSourceFileId = parsedSfId;
                if (parsedRowCount) capturedRowCount = parsedRowCount;
                if (parsedColCount) capturedColumnCount = parsedColCount;

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
                const sfId = capturedSourceFileId;
                if (!sfId) break;

                setSteps((prev) => prev.map((s) => ({ ...s, status: "completed" as const })));

                const suggestedLabel = (inner.suggestedLabel as string) ?? file.name.replace(/\.[^.]+$/, "");
                const overallQuality = inner.overallQuality as string | undefined;
                const avgConfidence = inner.avgConfidence as number | undefined;

                updateNodeData(projectId, nodeId, {
                  status: "ready",
                  rowCount: capturedRowCount,
                  columnCount: capturedColumnCount,
                  sourceFileId: sfId,
                  label: suggestedLabel,
                });

                fetchDetailedProfile(sfId)
                  .then((p) => {
                    setProfile(p);
                    setPhase("preview");
                    const issueCount = p.columns.filter((c) => {
                      const stats = c.nativeStats as Record<string, unknown>;
                      return Number(stats?.nullCount ?? 0) / p.rowCount > 0.1;
                    }).length;
                    if (issueCount > 0) {
                      updateNodeData(projectId, nodeId, { issueCount });
                    }
                  })
                  .catch(() => setPhase("preview"));

                fetchSampleRows(sfId, { page: 1, pageSize: 20 })
                  .then((res) => setSampleRows(res.data))
                  .catch(() => {});

                const thresholds = (projectSettings?.thresholds as Record<string, number>) ?? {};
                const reviewThreshold = thresholds.review ?? 0.6;
                const shouldSuggest =
                  overallQuality === "poor" || (avgConfidence != null && avgConfidence < reviewThreshold);

                if (shouldSuggest) {
                  setPendingMessage({
                    text: "Review the profile for this source and suggest a cleaning plan",
                    mentions: [{ label: suggestedLabel, id: nodeId, sourceFileId: sfId, category: "source" }],
                  });
                } else {
                  notifySourceReady(projectId, nodeId);
                }
                break;
              }
              case "error": {
                const msg = (inner.message as string) ?? "Upload failed";
                setError(msg);
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

  const setNodeContext = useAgentStore((s) => s.setNodeContext);
  const isPanelOpen = useAgentStore((s) => s.isPanelOpen);
  const togglePanel = useAgentStore((s) => s.togglePanel);
  const setPendingMessage = useAgentStore((s) => s.setPendingMessage);
  const projectSettings = useProjectStore(
    (s) => s.projects.find((p) => p.id === projectId)?.settings as Record<string, unknown> | undefined,
  );

  const preview = useMemo<SourcePreview | null>(() => {
    if (!profile) return null;

    const columns: SourcePreviewColumn[] = profile.columns.map((c) => {
      const stats = c.nativeStats as Record<string, unknown>;
      return {
        name: c.columnName,
        type: mapColumnType(stats?.detectedType as string),
        nullCount: Number(stats?.nullCount ?? 0),
        uniqueCount: Number(stats?.uniqueCount ?? 0),
        min: stats?.min as number | undefined,
        max: stats?.max as number | undefined,
        mean: stats?.mean as number | undefined,
        topValues: (stats?.topValues as { value: string }[])?.map((t) => t.value)
          ?? (stats?.sampleValues as string[])?.slice(0, 5),
      };
    });

    const totalNulls = columns.reduce((s, c) => s + c.nullCount, 0);
    const totalCells = profile.rowCount * profile.columnCount;
    const completeness = totalCells > 0 ? 1 - totalNulls / totalCells : 1;
    const issueCount = columns.filter(
      (c) => c.nullCount / profile.rowCount > 0.1,
    ).length;

    const summaryObj = profile.summary as Record<string, unknown> | string | null;
    const aiSummary = typeof summaryObj === "string"
      ? summaryObj
      : typeof summaryObj === "object" && summaryObj
        ? (summaryObj.description as string) ?? buildAutoSummary(profile, columns, issueCount)
        : buildAutoSummary(profile, columns, issueCount);

    const rows = (sampleRows ?? []) as Record<string, string | number | null>[];

    return {
      sourceFileId: profile.sourceFileId,
      filename: profile.filename,
      totalRows: profile.rowCount,
      totalColumns: profile.columnCount,
      columns,
      rows,
      aiSummary,
      issueCount,
      completeness,
    };
  }, [profile, sampleRows]);

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

  const handleOpenChat = useCallback(() => {
    if (!projectId || !node) return;
    selectNode(projectId, null);
    setNodeContext({
      nodeId,
      label: node.data.label,
      sourceFileId: sourceFileId ?? undefined,
      filename: profile?.filename,
    });
    if (!isPanelOpen) togglePanel();
  }, [projectId, nodeId, node, sourceFileId, profile, selectNode, setNodeContext, isPanelOpen, togglePanel]);

  const handleRequestCleanup = useCallback(() => {
    if (!projectId || !sourceFileId || !node) return;
    setPendingMessage({
      text: "Suggest a cleaning plan for this source — focus on quality issues",
      mentions: [{
        label: node.data.label,
        id: nodeId,
        sourceFileId,
        category: "source",
      }],
    });
    selectNode(projectId, null);
    if (!isPanelOpen) togglePanel();
  }, [projectId, nodeId, sourceFileId, node, setPendingMessage, selectNode, isPanelOpen, togglePanel]);

  const isCleanedDefault = (node?.data.activeVersion as string | undefined) === "cleaned";

  const handleSetDefault = useCallback(() => {
    if (!projectId || !sourceFileId) return;
    updateNodeData(projectId, nodeId, { activeVersion: "cleaned" });
    notifySourceReady(projectId, nodeId);
    toast.success("Cleaned dataset set as default for downstream nodes");
  }, [projectId, nodeId, sourceFileId, updateNodeData, notifySourceReady]);

  const handleQualityCheck = useCallback(() => {
    if (!projectId || !sourceFileId || !node) return;
    setPendingMessage({
      text: "Run a quality check on the cleaned version of this source — update your analysis with the results",
      mentions: [{
        label: node.data.label,
        id: nodeId,
        sourceFileId,
        category: "source",
      }],
    });
    selectNode(projectId, null);
    if (!isPanelOpen) togglePanel();
  }, [projectId, nodeId, sourceFileId, node, setPendingMessage, selectNode, isPanelOpen, togglePanel]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
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
            onClick={handleOpenChat}
            title="Open AI Chat"
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
        <div className="flex items-center gap-0.5 border-b border-cm-border-primary px-4 shrink-0">
          <button
            onClick={() => setSourceTab("data")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              sourceTab === "data"
                ? "border-cm-accent text-cm-accent"
                : "border-transparent text-cm-text-tertiary hover:text-cm-text-secondary"
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setSourceTab("ingestion")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              sourceTab === "ingestion"
                ? "border-cm-accent text-cm-accent"
                : "border-transparent text-cm-text-tertiary hover:text-cm-text-secondary"
            }`}
          >
            Ingestion
          </button>
        </div>
      )}

      {phase === "analyzing" && uploadedFile && (
        <SourceAnalyzingState
          filename={uploadedFile.name}
          fileSize={uploadedFile.size}
          steps={steps}
        />
      )}

      {sourceTab === "ingestion" && phase === "upload" && (
        <div className="flex-1 overflow-y-auto">
          <WebhookConfigPanel projectId={projectId} nodeId={nodeId} />
          <UpcomingConnectors />
        </div>
      )}

      {sourceTab === "data" && phase === "upload" && (
        <div className="flex-1 overflow-y-auto p-4">
          <SourceUploadZone onFileSelected={handleFileSelected} />
        </div>
      )}

      {sourceTab === "data" && phase === "preview" && preview && (
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <SourceSummaryBar
            preview={preview}
            onAiClick={handleOpenChat}
            onRequestCleanup={handleRequestCleanup}
            showCleanupCta={!hasCleanedVersion || dataView === "original"}
          />

          {hasCleanedVersion && (
            <div className="flex items-center gap-1 border-b border-cm-border-primary px-4 shrink-0">
              <button
                onClick={() => setDataView("original")}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  dataView === "original"
                    ? "border-cm-accent text-cm-accent"
                    : "border-transparent text-cm-text-tertiary hover:text-cm-text-secondary"
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setDataView("cleaned")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  dataView === "cleaned"
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-cm-text-tertiary hover:text-cm-text-secondary"
                }`}
              >
                <Sparkles className="h-3 w-3" />
                Cleaned
              </button>
            </div>
          )}

          {dataView === "original" && (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              {preview.issueCount > 0 && (
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
                    {showIssuesOnly ? `${preview.issueCount} issues` : `Show ${preview.issueCount} issues`}
                  </button>
                  <span className="text-[10px] text-cm-text-tertiary">
                    {showIssuesOnly ? "Showing issue columns" : "Showing all columns"}
                  </span>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-hidden">
                <SourceDataTable preview={preview} showIssuesOnly={showIssuesOnly} />
              </div>
            </div>
          )}

          {dataView === "cleaned" && sourceFileId && (
            <CleanedDataView
              sourceFileId={sourceFileId}
              initialRows={cleanedSampleRows}
              initialTotal={cleanedTotal}
              columns={preview.columns}
              isDefault={isCleanedDefault}
              onDataLoaded={(rows, total) => {
                setCleanedSampleRows(rows);
                setCleanedTotal(total);
              }}
              onSetDefault={handleSetDefault}
              onQualityCheck={handleQualityCheck}
            />
          )}
        </div>
      )}

      {sourceTab === "data" && phase === "preview" && !preview && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-cm-accent" />
        </div>
      )}
    </div>
  );
}

function mapColumnType(detected: string | undefined): "string" | "number" | "date" | "code" {
  if (!detected) return "string";
  const lower = detected.toLowerCase();
  if (lower.includes("int") || lower.includes("float") || lower.includes("number") || lower.includes("numeric"))
    return "number";
  if (lower.includes("date") || lower.includes("time") || lower.includes("timestamp"))
    return "date";
  if (lower.includes("code") || lower.includes("category") || lower.includes("enum"))
    return "code";
  return "string";
}

function buildAutoSummary(
  profile: DetailedProfileDTO,
  columns: SourcePreviewColumn[],
  issueCount: number,
): string {
  const domains = new Set<string>();
  for (const c of profile.columns) {
    const llm = c.llmInterpretation as Record<string, unknown>;
    if (llm?.domain) domains.add(String(llm.domain).replaceAll("_", " "));
  }

  const issueColumns = columns
    .filter((c) => c.nullCount / profile.rowCount > 0.1)
    .map((c) => c.name);

  let summary = `${profile.filename} with ${profile.rowCount.toLocaleString()} records`;
  if (domains.size > 0) summary += ` across ${domains.size} clinical domain${domains.size > 1 ? "s" : ""}`;
  summary += ".";

  if (issueCount > 0) {
    summary += ` ${issueCount} column${issueCount > 1 ? "s have" : " has"} quality issues`;
    if (issueColumns.length <= 3) {
      summary += ` — ${issueColumns.join(", ")}`;
    }
    summary += ".";
  }

  return summary;
}

const UPCOMING_CONNECTORS = [
  {
    icon: Database,
    name: "PostgreSQL",
    description: "Connect to a Postgres database and sync tables or views on a schedule.",
    color: "text-blue-600 bg-blue-50",
  },
  {
    icon: Database,
    name: "MySQL",
    description: "Pull data from MySQL databases with configurable sync intervals.",
    color: "text-orange-600 bg-orange-50",
  },
  {
    icon: Server,
    name: "SFTP / FTP",
    description: "Automatically ingest files from remote servers on a schedule.",
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    icon: Globe,
    name: "REST API",
    description: "Poll any REST endpoint and ingest JSON responses as tabular data.",
    color: "text-violet-600 bg-violet-50",
  },
  {
    icon: Clock,
    name: "Scheduled Import",
    description: "Configure cron-based imports from cloud storage (S3, GCS, Azure Blob).",
    color: "text-amber-600 bg-amber-50",
  },
] as const;

const CLEANED_PAGE_SIZE = 50;

function CleanedDataView({
  sourceFileId,
  initialRows,
  initialTotal,
  columns,
  isDefault,
  onDataLoaded,
  onSetDefault,
  onQualityCheck,
}: {
  sourceFileId: string;
  initialRows: Record<string, unknown>[] | null;
  initialTotal: number | null;
  columns: SourcePreviewColumn[];
  isDefault?: boolean;
  onDataLoaded: (rows: Record<string, unknown>[], total: number) => void;
  onSetDefault?: () => void;
  onQualityCheck?: () => void;
}) {
  const [qualityRequested, setQualityRequested] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(initialRows);
  const [total, setTotal] = useState<number | null>(initialTotal);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(!initialRows);
  const gridRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil((total ?? 0) / CLEANED_PAGE_SIZE));

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetchSampleRows(sourceFileId, { page: p + 1, pageSize: CLEANED_PAGE_SIZE }, "cleaned");
      const newRows = res.data as Record<string, unknown>[];
      setRows(newRows);
      setTotal(res.total);
      setPage(p);
      if (p === 0) onDataLoaded(newRows, res.total);
      gridRef.current?.scrollTo({ top: 0 });
    } catch {
      if (p === 0) setRows([]);
    } finally {
      setLoading(false);
    }
  }, [sourceFileId, onDataLoaded]);

  useEffect(() => {
    if (!initialRows) loadPage(0);
  }, [initialRows, loadPage]);

  if (!rows) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-cm-accent" />
      </div>
    );
  }

  if (rows.length === 0 && !loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12 gap-2 text-cm-text-tertiary">
        <AlertTriangle className="h-5 w-5" />
        <p className="text-xs">Could not load cleaned data preview</p>
      </div>
    );
  }

  const colNames = columns.map((c) => c.name);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-cm-border-primary bg-emerald-50/50 shrink-0 px-4 py-2.5 space-y-2.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-700">Cleaned version</span>
          {total != null && (
            <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-4 border-emerald-300 text-emerald-700">
              {total.toLocaleString()} rows
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSetDefault}
            disabled={isDefault}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-[11px] font-semibold transition-all ${
              isDefault
                ? "bg-emerald-100/80 text-emerald-600 cursor-default"
                : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-[0.99]"
            }`}
          >
            {isDefault ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Default dataset
              </>
            ) : (
              <>
                <Pin className="h-3 w-3" />
                Set as default
              </>
            )}
          </button>

          <button
            onClick={() => {
              setQualityRequested(true);
              onQualityCheck?.();
            }}
            disabled={qualityRequested}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-[11px] font-semibold transition-all ${
              qualityRequested
                ? "bg-emerald-100/80 text-emerald-600 cursor-default"
                : "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:scale-[0.99]"
            }`}
          >
            <ShieldCheck className={`h-3 w-3 ${qualityRequested ? "animate-pulse" : ""}`} />
            {qualityRequested ? "Checking..." : "Quality check"}
          </button>
        </div>
      </div>

      <div ref={gridRef} className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-cm-bg-elevated">
              <th className="w-10 border-b border-r border-cm-border-primary px-2 py-2 text-left text-[10px] font-medium text-cm-text-tertiary">
                #
              </th>
              {colNames.map((col) => (
                <th
                  key={col}
                  className="border-b border-r border-cm-border-primary px-2 py-1.5 text-left font-mono text-[11px] font-medium text-cm-text-primary"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={loading ? "opacity-40 pointer-events-none transition-opacity" : ""}>
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-cm-border-subtle transition-colors hover:bg-cm-bg-elevated/50"
              >
                <td className="border-r border-cm-border-subtle px-2 py-1.5 text-[10px] text-cm-text-tertiary tabular-nums text-right">
                  {page * CLEANED_PAGE_SIZE + rowIdx + 1}
                </td>
                {colNames.map((colName) => {
                  const value = row[colName];
                  const isNull = value === null || value === undefined || value === "";
                  return (
                    <td
                      key={colName}
                      className={`border-r border-cm-border-subtle px-2 py-1.5 font-mono text-[11px] max-w-[140px] truncate ${
                        isNull ? "text-cm-text-tertiary italic" : "text-cm-text-primary"
                      }`}
                      title={isNull ? "NULL" : String(value)}
                    >
                      {isNull ? "NULL" : String(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-cm-border-primary px-3 py-2 shrink-0 bg-cm-bg-surface">
          <p className="text-[10px] text-cm-text-tertiary tabular-nums">
            {(page * CLEANED_PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * CLEANED_PAGE_SIZE, total ?? 0).toLocaleString()} of {(total ?? 0).toLocaleString()}
          </p>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 0 || loading} onClick={() => loadPage(0)}>
              <ChevronsLeft className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 0 || loading} onClick={() => loadPage(page - 1)}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="px-2 text-[10px] text-cm-text-secondary tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page >= totalPages - 1 || loading} onClick={() => loadPage(page + 1)}>
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page >= totalPages - 1 || loading} onClick={() => loadPage(totalPages - 1)}>
              <ChevronsRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function UpcomingConnectors() {
  return (
    <div className="border-t border-cm-border-primary px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-xs font-semibold text-cm-text-primary">More Connectors</h4>
        <span className="rounded-full bg-cm-accent-subtle px-2 py-0.5 text-[9px] font-semibold text-cm-accent uppercase tracking-wide">
          Coming Soon
        </span>
      </div>
      <p className="text-[11px] text-cm-text-tertiary mb-3 leading-relaxed">
        Each source node can have its own ingestion method. Connect directly to databases,
        file servers, or APIs — all data flows through the same pipeline.
      </p>
      <div className="space-y-2">
        {UPCOMING_CONNECTORS.map((c) => (
          <div
            key={c.name}
            className="flex items-start gap-3 rounded-lg border border-cm-border-subtle p-3 opacity-75 cursor-default"
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${c.color}`}>
              <c.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-cm-text-primary">{c.name}</p>
                <Lock className="h-2.5 w-2.5 text-cm-text-tertiary" />
              </div>
              <p className="text-[10px] text-cm-text-tertiary leading-relaxed mt-0.5">
                {c.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
