import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { env } from "./env.js";

type SupportedProvider = "openai" | "anthropic" | "custom";

const providers: Record<SupportedProvider, () => LanguageModel> = {
  openai: () => {
    const provider = createOpenAI({ apiKey: env.OPENAI_API_KEY ?? "" });
    return provider(env.LLM_MODEL);
  },
  anthropic: () => {
    const provider = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY ?? "" });
    return provider(env.LLM_MODEL);
  },
  custom: () => {
    const provider = createOpenAI({
      baseURL: env.CUSTOM_LLM_BASE_URL ?? "",
      apiKey: env.CUSTOM_LLM_API_KEY ?? "",
    });
    return provider(env.CUSTOM_LLM_MODEL ?? env.LLM_MODEL);
  },
};

export function getModel(): LanguageModel {
  return providers[env.LLM_PROVIDER]();
}

export function getModelId(): string {
  if (env.LLM_PROVIDER === "custom" && env.CUSTOM_LLM_MODEL) {
    return env.CUSTOM_LLM_MODEL;
  }
  return env.LLM_MODEL;
}
