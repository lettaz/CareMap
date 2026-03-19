import { useProjectStore } from "@/lib/stores/project-store";

export function useActiveProject() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const project = activeProjectId ? projects.find((p) => p.id === activeProjectId) ?? null : null;

  return { projectId: activeProjectId, project };
}
