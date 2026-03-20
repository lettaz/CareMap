import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Workflow, Clock, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProjectStore } from "@/lib/stores/project-store";

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, loading, error, fetchProjects, createProject } = useProjectStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const id = await createProject(newName.trim(), newDesc.trim());
      setNewName("");
      setNewDesc("");
      setDialogOpen(false);
      navigate(`/projects/${id}/canvas`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-cm-text-primary">Projects</h1>
            <p className="mt-1 text-sm text-cm-text-secondary">
              Each project is a data-engineering task with its own pipeline and dashboard.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button className="bg-cm-accent text-white hover:bg-cm-accent-hover" />}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Project
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-cm-text-primary">Name</label>
                  <Input
                    placeholder="e.g. Patient Vitals Pipeline"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-cm-text-primary">Description</label>
                  <Input
                    placeholder="Brief description of this data task..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  className="bg-cm-accent text-white hover:bg-cm-accent-hover"
                >
                  {creating && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading && projects.length === 0 && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col rounded-lg border border-cm-border-primary bg-cm-bg-surface p-5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-full" />
                <Skeleton className="mt-1 h-3 w-2/3" />
                <div className="mt-auto flex items-center gap-4 pt-4">
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && projects.length === 0 && !error && (
          <div className="mt-20 flex flex-col items-center justify-center text-cm-text-secondary">
            <Workflow className="h-12 w-12 opacity-30" />
            <p className="mt-3 text-sm">No projects yet. Create one to get started.</p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(`/projects/${project.id}/canvas`)}
              className="flex flex-col rounded-lg border border-cm-border-primary bg-cm-bg-surface p-5 text-left shadow-sm transition-all hover:border-cm-accent/40 hover:shadow-md"
            >
              <h3 className="text-sm font-semibold text-cm-text-primary">{project.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-cm-text-secondary">
                {project.description}
              </p>

              <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-cm-text-tertiary">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatRelativeDate(project.updatedAt)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
