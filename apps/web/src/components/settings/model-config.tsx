import { useState } from "react";
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

export function ModelConfig() {
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0].id);
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");

  const isCustom = selectedModel === "custom";
  const selectedLabel =
    MODEL_OPTIONS.find((m) => m.id === selectedModel)?.label ?? "Select model";

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

      <Button size="sm">Save Configuration</Button>
    </div>
  );
}
