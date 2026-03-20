import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ModelConfig } from "@/components/settings/model-config";
import { MappingThresholds } from "@/components/settings/mapping-thresholds";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Zap, Loader2, Pencil, Check, X } from "lucide-react";
import { useProjectStore } from "@/lib/stores/project-store";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId) ?? null);
  const updateProjectSettings = useProjectStore((s) => s.updateProjectSettings);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [savingName, setSavingName] = useState(false);

  const yoloMode = (project?.settings?.yoloMode as boolean) ?? false;

  const startEditName = useCallback(() => {
    if (!project) return;
    setNameValue(project.name);
    setDescValue(project.description ?? "");
    setEditingName(true);
  }, [project]);

  const saveNameEdit = useCallback(async () => {
    if (!project || !nameValue.trim()) return;
    setSavingName(true);
    try {
      await updateProject(project.id, {
        name: nameValue.trim(),
        description: descValue.trim() || undefined,
      });
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  }, [project, nameValue, descValue, updateProject]);

  const handleYoloToggle = useCallback(
    (checked: boolean) => {
      if (!project) return;
      updateProjectSettings(project.id, { yoloMode: checked });
    },
    [project, updateProjectSettings],
  );

  const handleClearData = useCallback(async () => {
    if (!project) return;
    setClearing(true);
    try {
      await deleteProject(project.id);
      setClearOpen(false);
      navigate("/projects");
    } finally {
      setClearing(false);
    }
  }, [project, deleteProject, navigate]);

  return (
    <div className="h-full overflow-y-auto bg-cm-bg-app p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6 sm:space-y-8">
        <h1 className="text-xl font-semibold text-cm-text-primary">Settings</h1>

        {project && (
          <>
            <section className="space-y-4">
              <h2 className="text-sm font-medium text-cm-text-secondary uppercase tracking-wider">
                Project Info
              </h2>
              <div className="rounded-lg border border-cm-border-primary bg-cm-bg-surface p-4">
                {editingName ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-cm-text-secondary">Name</label>
                      <Input
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveNameEdit()}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-cm-text-secondary">Description</label>
                      <Input
                        value={descValue}
                        onChange={(e) => setDescValue(e.target.value)}
                        placeholder="Brief description..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={saveNameEdit}
                        disabled={!nameValue.trim() || savingName}
                        className="h-7 text-xs bg-cm-accent text-white hover:bg-cm-accent-hover"
                      >
                        {savingName ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingName(false)} className="h-7 text-xs">
                        <X className="mr-1 h-3 w-3" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-cm-text-primary">{project.name}</p>
                      <p className="mt-0.5 text-xs text-cm-text-secondary">
                        {project.description || "No description"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={startEditName}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-cm-text-tertiary hover:bg-cm-bg-hover hover:text-cm-text-primary transition-colors shrink-0"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <h2 className="text-sm font-medium text-cm-text-secondary uppercase tracking-wider">
                Pipeline Mode
              </h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-cm-border-primary bg-cm-bg-surface p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cm-accent-subtle">
                    <Zap className="h-4 w-4 text-cm-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-cm-text-primary">YOLO Mode</p>
                    <p className="text-xs text-cm-text-secondary mt-0.5">
                      Skip approval prompts for destructive AI operations (cleaning, harmonization, scripts).
                    </p>
                  </div>
                </div>
                <Switch
                  checked={yoloMode}
                  onCheckedChange={handleYoloToggle}
                />
              </div>
            </section>

            <Separator />
          </>
        )}

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-cm-text-secondary uppercase tracking-wider">
            Model Configuration
          </h2>
          <ModelConfig />
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-cm-text-secondary uppercase tracking-wider">
            Mapping Thresholds
          </h2>
          <MappingThresholds />
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-cm-text-secondary uppercase tracking-wider">
            Danger Zone
          </h2>
          <div className="rounded-lg border border-cm-error/20 bg-cm-error-subtle p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-cm-text-primary">Delete Project</p>
                <p className="text-xs text-cm-text-secondary mt-0.5">
                  Permanently remove this project and all its data.
                </p>
              </div>
              <Dialog open={clearOpen} onOpenChange={setClearOpen}>
                <DialogTrigger render={<Button variant="destructive" size="sm" />}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete project?</DialogTitle>
                    <DialogDescription>
                      This will permanently delete all uploaded sources, column profiles, field
                      mappings, agent conversations, and pinned dashboard widgets. This action
                      cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setClearOpen(false)} disabled={clearing}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleClearData} disabled={clearing}>
                      {clearing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      Delete Everything
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
