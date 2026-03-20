import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Workflow, Clock, Loader2, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProjectStore } from "@/lib/stores/project-store";
import type { Project } from "@/lib/types";

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
  const { projects, loading, error, fetchProjects, createProject, deleteProject, updateProject } = useProjectStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const openEdit = useCallback((p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(p.name);
    setEditDesc(p.description ?? "");
    setEditTarget(p);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget || !editName.trim()) return;
    setSaving(true);
    try {
      await updateProject(editTarget.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setEditTarget(null);
    } finally {
      setSaving(false);
    }
  }, [editTarget, editName, editDesc, updateProject]);

  const openDelete = useCallback((p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(p);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteProject]);

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
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/projects/${project.id}/canvas`)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/projects/${project.id}/canvas`)}
              className="group relative flex flex-col rounded-lg border border-cm-border-primary bg-cm-bg-surface p-5 text-left shadow-sm transition-all hover:border-cm-accent/40 hover:shadow-md cursor-pointer"
            >
              <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => openEdit(project, e)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-cm-text-tertiary hover:bg-cm-bg-hover hover:text-cm-text-primary transition-colors"
                  title="Rename"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => openDelete(project, e)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-cm-text-tertiary hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <h3 className="text-sm font-semibold text-cm-text-primary pr-16">{project.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-cm-text-secondary">
                {project.description}
              </p>

              <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-cm-text-tertiary">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatRelativeDate(project.updatedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Edit project dialog */}
        <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-cm-text-primary">Name</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-cm-text-primary">Description</label>
                <Input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button
                onClick={handleSaveEdit}
                disabled={!editName.trim() || saving}
                className="bg-cm-accent text-white hover:bg-cm-accent-hover"
              >
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete project dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete project?</DialogTitle>
              <DialogDescription>
                This will permanently delete <strong>{deleteTarget?.name}</strong> and all its data
                (sources, profiles, mappings, conversations). This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
                {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
