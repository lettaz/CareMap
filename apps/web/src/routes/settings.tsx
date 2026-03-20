import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ModelConfig } from "@/components/settings/model-config";
import { MappingThresholds } from "@/components/settings/mapping-thresholds";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
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
import { Trash2, Zap, Loader2 } from "lucide-react";
import { useActiveProject } from "@/hooks/use-active-project";
import { useProjectStore } from "@/lib/stores/project-store";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { project } = useActiveProject();
  const updateProjectSettings = useProjectStore((s) => s.updateProjectSettings);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const yoloMode = (project?.settings?.yoloMode as boolean) ?? false;

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
