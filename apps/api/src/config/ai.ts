import OpenAI from "openai";
import { env } from "./env.js";

function createAIClient(): OpenAI {
  if (env.LLM_PROVIDER === "custom" && env.CUSTOM_LLM_BASE_URL) {
    return new OpenAI({
      baseURL: env.CUSTOM_LLM_BASE_URL,
      apiKey: env.CUSTOM_LLM_API_KEY ?? "",
    });
  }

  if (env.LLM_PROVIDER === "anthropic") {
    return new OpenAI({
      baseURL: "https://api.anthropic.com/v1",
      apiKey: env.ANTHROPIC_API_KEY ?? "",
      defaultHeaders: { "anthropic-version": "2023-06-01" },
    });
  }

  return new OpenAI({ apiKey: env.OPENAI_API_KEY ?? "" });
}

export const ai = createAIClient();

export function getModelId(): string {
  if (env.LLM_PROVIDER === "custom" && env.CUSTOM_LLM_MODEL) {
    return env.CUSTOM_LLM_MODEL;
  }
  return env.LLM_MODEL;
}
