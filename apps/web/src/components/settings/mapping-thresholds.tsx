import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Save, Check } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/lib/stores/project-store";

interface ThresholdSettings {
  autoAccept: number;
  review: number;
}

export function MappingThresholds() {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId) ?? null);
  const updateProjectSettings = useProjectStore((s) => s.updateProjectSettings);

  const saved = (project?.settings?.thresholds ?? {}) as Partial<ThresholdSettings>;
  const [autoAccept, setAutoAccept] = useState(saved.autoAccept ?? 0.85);
  const [review, setReview] = useState(saved.review ?? 0.6);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saved.autoAccept != null) setAutoAccept(saved.autoAccept);
    if (saved.review != null) setReview(saved.review);
  }, [saved.autoAccept, saved.review]);

  const hasChanges =
    autoAccept !== (saved.autoAccept ?? 0.85) || review !== (saved.review ?? 0.6);

  const handleSave = useCallback(async () => {
    if (!project || saving) return;
    setSaving(true);
    try {
      await updateProjectSettings(project.id, {
        thresholds: { autoAccept, review },
      });
      toast.success("Thresholds saved");
    } catch {
      toast.error("Failed to save thresholds");
    } finally {
      setSaving(false);
    }
  }, [project, autoAccept, review, saving, updateProjectSettings]);

  function handleAutoAccept(val: number | readonly number[]) {
    const v = (Array.isArray(val) ? val[0] : (val as number)) / 100;
    setAutoAccept(v);
  }

  function handleReview(val: number | readonly number[]) {
    const v = (Array.isArray(val) ? val[0] : (val as number)) / 100;
    setReview(v);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-cm-text-primary">
            Auto-accept threshold
          </label>
          <span className="text-sm tabular-nums text-cm-text-secondary">
            {autoAccept.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[autoAccept * 100]}
          onValueChange={handleAutoAccept}
          min={0}
          max={100}
          step={1}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-cm-text-primary">
            Review threshold
          </label>
          <span className="text-sm tabular-nums text-cm-text-secondary">
            {review.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[review * 100]}
          onValueChange={handleReview}
          min={0}
          max={100}
          step={1}
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={!hasChanges || saving}
        className="w-full gap-2"
        size="sm"
      >
        {saving ? (
          <>Saving...</>
        ) : hasChanges ? (
          <>
            <Save className="h-3.5 w-3.5" />
            Save Thresholds
          </>
        ) : (
          <>
            <Check className="h-3.5 w-3.5" />
            Saved
          </>
        )}
      </Button>

      <div className="rounded-lg border border-cm-border-subtle bg-cm-bg-elevated p-3 text-xs leading-relaxed text-cm-text-secondary space-y-1.5">
        <p>
          Mappings with confidence <strong>&ge; {autoAccept.toFixed(2)}</strong> are accepted
          automatically. Confidence between{" "}
          <strong>{review.toFixed(2)}</strong> and{" "}
          <strong>{autoAccept.toFixed(2)}</strong> requires manual review. Below{" "}
          <strong>{review.toFixed(2)}</strong> mappings are rejected.
        </p>
        <p>
          After profiling, if the average column confidence falls below{" "}
          <strong>{review.toFixed(2)}</strong>, CareMap AI will proactively suggest a data
          cleaning plan.
        </p>
      </div>
    </div>
  );
}
