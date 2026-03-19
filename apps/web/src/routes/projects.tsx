import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Workflow, BarChart3, Clock } from "lucide-react";
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
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

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
  const { projects, createProject } = useProjectStore();
  const pipelines = usePipelineStore((s) => s.pipelines);
  const dashboards = useDashboardStore((s) => s.dashboards);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  function handleCreate() {
    if (!newName.trim()) return;
    const id = createProject(newName.trim(), newDesc.trim());
    setNewName("");
    setNewDesc("");
    setDialogOpen(false);
    navigate(`/projects/${id}/canvas`);
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-cm-text-primary">Projects</h1>
            <p className="mt-1 text-sm text-cm-text-secondary">
              Each project is a data-engineering task with its own pipeline and dashboard.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-cm-accent text-white hover:bg-cm-accent-hover">
                <Plus className="mr-1.5 h-4 w-4" />
                New Project
              </Button>
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
                  disabled={!newName.trim()}
                  className="bg-cm-accent text-white hover:bg-cm-accent-hover"
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const pipeline = pipelines[project.id];
            const dashboard = dashboards[project.id];
            const nodeCount = pipeline?.nodes.length ?? 0;
            const alertCount = dashboard?.alerts.filter((a) => !a.acknowledged).length ?? 0;

            return (
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
                    <Workflow className="h-3.5 w-3.5" />
                    {nodeCount} nodes
                  </span>
                  {alertCount > 0 && (
                    <span className="flex items-center gap-1 text-cm-warning">
                      <BarChart3 className="h-3.5 w-3.5" />
                      {alertCount} alerts
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatRelativeDate(project.updatedAt)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
