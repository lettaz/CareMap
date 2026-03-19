import { create } from "zustand";
import type { Project } from "@/lib/types";
import { MOCK_PROJECTS } from "@/lib/mock-data";

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  createProject: (name: string, description: string) => string;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  updateProject: (id: string, partial: Partial<Pick<Project, "name" | "description">>) => void;
}

export const useProjectStore = create<ProjectState>()((set) => ({
  projects: MOCK_PROJECTS,
  activeProjectId: null,

  createProject: (name, description) => {
    const id = `proj-${Date.now()}`;
    const now = new Date().toISOString();
    const project: Project = { id, name, description, createdAt: now, updatedAt: now };
    set((state) => ({ projects: [...state.projects, project] }));
    return id;
  },

  deleteProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
    })),

  setActiveProject: (id) => set({ activeProjectId: id }),

  updateProject: (id, partial) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...partial, updatedAt: new Date().toISOString() } : p
      ),
    })),
}));
