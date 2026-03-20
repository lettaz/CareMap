import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (saved.autoAccept != null) setAutoAccept(saved.autoAccept);
    if (saved.review != null) setReview(saved.review);
  }, [saved.autoAccept, saved.review]);

  const persist = useCallback(
    (next: ThresholdSettings) => {
      if (!project) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateProjectSettings(project.id, { thresholds: next });
      }, 600);
    },
    [project, updateProjectSettings],
  );

  function handleAutoAccept(val: number | readonly number[]) {
    const v = (Array.isArray(val) ? val[0] : (val as number)) / 100;
    setAutoAccept(v);
    persist({ autoAccept: v, review });
  }

  function handleReview(val: number | readonly number[]) {
    const v = (Array.isArray(val) ? val[0] : (val as number)) / 100;
    setReview(v);
    persist({ autoAccept, review: v });
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
