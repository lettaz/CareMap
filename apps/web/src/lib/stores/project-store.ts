import { create } from "zustand";
import { toast } from "sonner";
import type { Project } from "@/lib/types";
import {
  fetchProjects as apiFetchProjects,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
  type ProjectDTO,
} from "@/lib/api/projects";

function toProject(dto: ProjectDTO): Project {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? "",
    settings: dto.settings,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  createProject: (name: string, description: string) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (id: string | null) => void;
  updateProject: (id: string, partial: Partial<Pick<Project, "name" | "description">>) => Promise<void>;
  updateProjectSettings: (id: string, settings: Record<string, unknown>) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  activeProjectId: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const dtos = await apiFetchProjects();
      set({ projects: dtos.map(toProject), loading: false });
    } catch (err) {
      const msg = (err as Error).message;
      set({ error: msg, loading: false });
      toast.error("Failed to load projects", { description: msg });
    }
  },

  createProject: async (name, description) => {
    set({ error: null });
    try {
      const dto = await apiCreateProject(name, description);
      const project = toProject(dto);
      set((state) => ({ projects: [project, ...state.projects] }));
      toast.success("Project created", { description: project.name });
      return project.id;
    } catch (err) {
      const msg = (err as Error).message;
      set({ error: msg });
      toast.error("Failed to create project", { description: msg });
      throw err;
    }
  },

  deleteProject: async (id) => {
    set({ error: null });
    try {
      await apiDeleteProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
      }));
      toast.success("Project deleted");
    } catch (err) {
      const msg = (err as Error).message;
      set({ error: msg });
      toast.error("Failed to delete project", { description: msg });
    }
  },

  setActiveProject: (id) => set({ activeProjectId: id }),

  updateProject: async (id, partial) => {
    set({ error: null });
    try {
      const dto = await apiUpdateProject(id, partial);
      const updated = toProject(dto);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updated : p)),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  updateProjectSettings: async (id, settings) => {
    set({ error: null });
    try {
      const current = get().projects.find((p) => p.id === id);
      const merged = { ...current?.settings, ...settings };
      const dto = await apiUpdateProject(id, { settings: merged });
      const updated = toProject(dto);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updated : p)),
      }));
    } catch (err) {
      const msg = (err as Error).message;
      set({ error: msg });
      toast.error("Failed to save settings", { description: msg });
    }
  },
}));
