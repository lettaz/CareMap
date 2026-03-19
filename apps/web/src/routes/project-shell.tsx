import { useEffect } from "react";
import { Outlet, useParams, Navigate, useLocation } from "react-router-dom";
import { useProjectStore } from "@/lib/stores/project-store";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { RightPanel } from "@/components/layout/right-panel";

export default function ProjectShell() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const projects = useProjectStore((s) => s.projects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const ensurePipeline = usePipelineStore((s) => s.ensurePipeline);
  const ensureSession = useAgentStore((s) => s.ensureSession);
  const ensureDashboard = useDashboardStore((s) => s.ensureDashboard);

  const projectExists = projects.some((p) => p.id === projectId);
  const isCanvasRoute = location.pathname.endsWith("/canvas");

  useEffect(() => {
    if (!projectId || !projectExists) return;
    setActiveProject(projectId);
    ensurePipeline(projectId);
    ensureSession(projectId);
    ensureDashboard(projectId);
    return () => setActiveProject(null);
  }, [projectId, projectExists, setActiveProject, ensurePipeline, ensureSession, ensureDashboard]);

  if (!projectId || !projectExists) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen flex-col bg-cm-bg-app overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
        <RightPanel isCanvasRoute={isCanvasRoute} />
      </div>
    </div>
  );
}
