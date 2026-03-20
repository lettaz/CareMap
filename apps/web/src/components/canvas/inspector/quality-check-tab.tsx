import { useState, useCallback, useEffect } from "react";
import {
  ShieldCheck,
  Play,
  Loader2,
  CircleCheck,
  AlertTriangle,
  CircleX,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveProject } from "@/hooks/use-active-project";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { triggerPipeline } from "@/lib/api/pipeline";
import { runQualityCheck, fetchAlertsPaginated } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

interface QualityCheckTabProps {
  nodeId: string;
}

interface CheckResult {
  persisted: number;
  alerts: Array<{
    id: string;
    severity: string;
    summary: string;
    affectedCount: number;
  }>;
}

export function QualityCheckTab({ nodeId }: QualityCheckTabProps) {
  const { projectId } = useActiveProject();
  const updateNodeData = usePipelineStore((s) => s.updateNodeData);
  const node = usePipelineStore((s) =>
    projectId ? s.pipelines[projectId]?.nodes.find((n) => n.id === nodeId) : undefined,
  );

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);

  const handleQuickCheck = useCallback(async () => {
    if (!projectId) return;
    setRunning(true);
    try {
      if (updateNodeData) {
        updateNodeData(projectId, nodeId, { status: "running" });
      }

      const res = await runQualityCheck(projectId);
      setResult(res);

      const critical = res.alerts.filter((a) => a.severity === "critical").length;
      const warnings = res.alerts.filter((a) => a.severity === "warning").length;
      const info = res.alerts.filter((a) => a.severity === "info").length;

      if (updateNodeData) {
        updateNodeData(projectId, nodeId, {
          status: critical > 0 ? "error" : warnings > 0 ? "warning" : "ready",
          checksFail: critical,
          checksWarn: warnings,
          checksPass: info + (res.persisted === 0 ? 1 : 0),
          issueCount: critical + warnings,
          description: `Found ${res.alerts.length} issue${res.alerts.length !== 1 ? "s" : ""} across quality checks`,
        });
      }
    } catch {
      if (updateNodeData) {
        updateNodeData(projectId, nodeId, { status: "error" });
      }
    } finally {
      setRunning(false);
    }
  }, [projectId, nodeId, updateNodeData]);

  const refreshAlertsFromDb = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetchAlertsPaginated(projectId, { page: 1, pageSize: 200 });
      const alerts = res.data;

      const critical = alerts.filter((a) => a.severity === "critical").length;
      const warnings = alerts.filter((a) => a.severity === "warning").length;
      const info = alerts.filter((a) => a.severity === "info" || (a.severity !== "critical" && a.severity !== "warning")).length;

      setResult({
        persisted: alerts.length,
        alerts: alerts.map((a) => ({
          id: a.id,
          severity: a.severity,
          summary: a.summary,
          affectedCount: a.affectedCount,
        })),
      });

      if (updateNodeData) {
        updateNodeData(projectId, nodeId, {
          status: critical > 0 ? "error" : warnings > 0 ? "warning" : "ready",
          checksFail: critical,
          checksWarn: warnings,
          checksPass: info + (alerts.length === 0 ? 1 : 0),
          issueCount: critical + warnings,
          description: alerts.length > 0
            ? `Found ${alerts.length} issue${alerts.length !== 1 ? "s" : ""} across quality checks`
            : "All quality checks passed",
        });
      }
    } catch { /* non-fatal */ }
  }, [projectId, nodeId, updateNodeData]);

  const handleDeepCheck = useCallback(async () => {
    if (!projectId) return;
    setAgentRunning(true);

    if (updateNodeData) {
      updateNodeData(projectId, nodeId, { status: "running" });
    }

    try {
      const { url, body } = triggerPipeline(projectId, nodeId, "quality_check_requested");
      const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
      const response = await fetch(`${apiBase}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }

      await refreshAlertsFromDb();
    } catch {
      if (updateNodeData) {
        updateNodeData(projectId, nodeId, { status: "error" });
      }
    } finally {
      setAgentRunning(false);
    }
  }, [projectId, nodeId, updateNodeData, refreshAlertsFromDb]);

  useEffect(() => {
    refreshAlertsFromDb();
  }, [refreshAlertsFromDb]);

  const pass = node?.data.checksPass ?? 0;
  const warn = node?.data.checksWarn ?? 0;
  const fail = node?.data.checksFail ?? 0;
  const hasResults = pass + warn + fail > 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Actions */}
      <div className="space-y-2">
        <Button
          onClick={handleQuickCheck}
          disabled={running || agentRunning}
          className="w-full gap-2"
          variant="default"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {running ? "Scanning..." : "Quick Check"}
        </Button>
        <Button
          onClick={handleDeepCheck}
          disabled={running || agentRunning}
          className="w-full gap-2"
          variant="outline"
        >
          {agentRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {agentRunning ? "Agent running..." : "Deep Check (AI Agent)"}
        </Button>
        <p className="text-[11px] text-cm-text-tertiary">
          Quick check scans profiles and mappings. Deep check uses the AI agent to scan harmonized data in a sandbox.
        </p>
      </div>

      {/* Results summary */}
      {hasResults && (
        <div className="rounded-lg border border-cm-border-primary p-3">
          <p className="mb-2 text-xs font-semibold text-cm-text-primary">Check Results</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <CircleCheck className="h-4 w-4" />
              {pass}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              {warn}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-red-600">
              <CircleX className="h-4 w-4" />
              {fail}
            </span>
          </div>
        </div>
      )}

      {/* Alert list from latest check */}
      {result && result.alerts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-cm-text-primary">
            Issues Found ({result.alerts.length})
          </p>
          <div className="max-h-[300px] space-y-1.5 overflow-y-auto">
            {result.alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "rounded-md border-l-3 p-2.5 text-xs",
                  alert.severity === "critical" && "border-l-red-500 bg-cm-error-subtle",
                  alert.severity === "warning" && "border-l-amber-500 bg-cm-warning-subtle",
                  alert.severity === "info" && "border-l-blue-500 bg-cm-info-subtle",
                )}
              >
                <div className="flex items-start gap-1.5">
                  {alert.severity === "critical" && <CircleX className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />}
                  {alert.severity === "warning" && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />}
                  {alert.severity === "info" && <CircleCheck className="mt-0.5 h-3 w-3 shrink-0 text-blue-600" />}
                  <span className="text-cm-text-primary">{alert.summary}</span>
                </div>
                {alert.affectedCount > 0 && (
                  <span className="mt-1 block text-[10px] text-cm-text-tertiary">
                    {alert.affectedCount} affected
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result && result.alerts.length === 0 && (
        <div className="rounded-lg border border-cm-border-subtle p-4 text-center">
          <CircleCheck className="mx-auto h-6 w-6 text-emerald-500" />
          <p className="mt-1.5 text-sm font-medium text-cm-text-primary">All clear</p>
          <p className="mt-0.5 text-xs text-cm-text-tertiary">
            No new quality issues detected.
          </p>
        </div>
      )}

      {!result && !hasResults && (
        <div className="rounded-lg border border-dashed border-cm-border-primary p-4 text-center">
          <Clock className="mx-auto h-5 w-5 text-cm-text-tertiary" />
          <p className="mt-1.5 text-xs text-cm-text-tertiary">
            No checks run yet. Click a button above to scan for issues.
          </p>
        </div>
      )}
    </div>
  );
}
