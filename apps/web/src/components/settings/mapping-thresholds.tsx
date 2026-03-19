import { useState } from "react";
import { Slider } from "@/components/ui/slider";

export function MappingThresholds() {
  const [autoAccept, setAutoAccept] = useState(0.85);
  const [review, setReview] = useState(0.6);

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
          onValueChange={(val: number[]) => setAutoAccept(val[0] / 100)}
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
          onValueChange={(val: number[]) => setReview(val[0] / 100)}
          min={0}
          max={100}
          step={1}
        />
      </div>

      <div className="rounded-lg border border-cm-border-subtle bg-cm-bg-elevated p-3 text-xs leading-relaxed text-cm-text-secondary">
        <p>
          Mappings with confidence <strong>≥ {autoAccept.toFixed(2)}</strong> are accepted
          automatically. Confidence between{" "}
          <strong>{review.toFixed(2)}</strong> and{" "}
          <strong>{autoAccept.toFixed(2)}</strong> requires manual review. Below{" "}
          <strong>{review.toFixed(2)}</strong> mappings are rejected.
        </p>
      </div>
    </div>
  );
}
