import { useState, useEffect, useCallback } from "react";
import { MODEL_OPTIONS } from "@/lib/constants";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { useActiveProject } from "@/hooks/use-active-project";
import { useProjectStore } from "@/lib/stores/project-store";

interface ModelSettings {
  provider: string;
  endpoint?: string;
  apiKey?: string;
  modelName?: string;
}

export function ModelConfig() {
  const { project } = useActiveProject();
  const updateProjectSettings = useProjectStore((s) => s.updateProjectSettings);

  const saved = (project?.settings?.model ?? {}) as Partial<ModelSettings>;
  const [selectedModel, setSelectedModel] = useState(saved.provider || MODEL_OPTIONS[0].id);
  const [endpoint, setEndpoint] = useState(saved.endpoint ?? "");
  const [apiKey, setApiKey] = useState(saved.apiKey ?? "");
  const [modelName, setModelName] = useState(saved.modelName ?? "");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!saved.provider) return;
    setSelectedModel(saved.provider);
    setEndpoint(saved.endpoint ?? "");
    setApiKey(saved.apiKey ?? "");
    setModelName(saved.modelName ?? "");
  }, [saved.provider, saved.endpoint, saved.apiKey, saved.modelName]);

  const isCustom = selectedModel === "custom";
  const selectedLabel =
    MODEL_OPTIONS.find((m) => m.id === selectedModel)?.label ?? "Select model";

  const handleSave = useCallback(async () => {
    if (!project) return;
    setSaving(true);
    try {
      const model: ModelSettings = { provider: selectedModel };
      if (isCustom) {
        model.endpoint = endpoint;
        model.apiKey = apiKey;
        model.modelName = modelName;
      }
      await updateProjectSettings(project.id, { model });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [project, selectedModel, isCustom, endpoint, apiKey, modelName, updateProjectSettings]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-cm-text-primary">Model</label>
        <Select
          value={selectedModel}
          onValueChange={(val) => setSelectedModel(val as string)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select model">{selectedLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                <span>{opt.label}</span>
                <span className="ml-1 text-cm-text-tertiary">· {opt.provider}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isCustom && (
        <div className="space-y-3 rounded-lg border border-cm-border-subtle bg-cm-bg-elevated p-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-cm-text-primary">
              Endpoint URL
            </label>
            <Input
              placeholder="https://api.example.com/v1"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-cm-text-primary">API Key</label>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-cm-text-primary">
              Model Name
            </label>
            <Input
              placeholder="my-custom-model"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
          </div>
        </div>
      )}

      <Button size="sm" onClick={handleSave} disabled={saving || !project}>
        {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        {justSaved && <Check className="mr-1.5 h-3.5 w-3.5 text-cm-success" />}
        {justSaved ? "Saved" : "Save Configuration"}
      </Button>
    </div>
  );
}
