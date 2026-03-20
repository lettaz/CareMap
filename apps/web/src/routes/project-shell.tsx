import { useEffect } from "react";
import { Outlet, useParams, Navigate, useLocation } from "react-router-dom";
import { useProjectStore } from "@/lib/stores/project-store";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { RightPanel } from "@/components/layout/right-panel";

export default function ProjectShell() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.loading);
  const hydrated = useProjectStore((s) => s.hydrated);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const ensurePipeline = usePipelineStore((s) => s.ensurePipeline);
  const ensureDashboard = useDashboardStore((s) => s.ensureDashboard);

  const projectExists = projects.some((p) => p.id === projectId);
  const isCanvasRoute = location.pathname.endsWith("/canvas");

  useEffect(() => {
    if (!hydrated && !loading) fetchProjects();
  }, [hydrated, loading, fetchProjects]);

  useEffect(() => {
    if (!projectId || !projectExists) return;
    setActiveProject(projectId);
    ensurePipeline(projectId);
    ensureDashboard(projectId);
    return () => setActiveProject(null);
  }, [projectId, projectExists, setActiveProject, ensurePipeline, ensureDashboard]);

  if (!hydrated || loading) return null;

  if (!projectId || !projectExists) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      <div className="h-full flex-1 overflow-hidden">
        <Outlet />
      </div>
      <RightPanel isCanvasRoute={isCanvasRoute} />
    </div>
  );
}
