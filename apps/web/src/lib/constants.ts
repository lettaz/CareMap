import type { NodeCategory } from "./types";

export const NODE_CATEGORIES: {
  id: NodeCategory;
  label: string;
  colour: string;
  icon: string;
}[] = [
  { id: "source", label: "Source", colour: "#3b82f6", icon: "FileUp" },
  { id: "transform", label: "Transform", colour: "#10b981", icon: "Shuffle" },
  { id: "quality", label: "Quality", colour: "#f59e0b", icon: "ShieldCheck" },
  { id: "sink", label: "Sink", colour: "#6366f1", icon: "Database" },
];

export const MODEL_OPTIONS: {
  id: string;
  label: string;
  provider: string;
}[] = [
  { id: "gpt-5.2", label: "GPT-5.2", provider: "OpenAI" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4", provider: "Anthropic" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
  { id: "llama-4-scout", label: "Llama 4 Scout", provider: "Meta" },
  { id: "custom", label: "Custom", provider: "Custom" },
];
