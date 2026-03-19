import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  LLM_PROVIDER: z.enum(["openai", "anthropic", "custom"]).default("openai"),
  LLM_MODEL: z.string().default("gpt-5.2-codex"),

  CUSTOM_LLM_BASE_URL: z.string().url().optional(),
  CUSTOM_LLM_API_KEY: z.string().optional(),
  CUSTOM_LLM_MODEL: z.string().optional(),

  E2B_API_KEY: z.string().min(1),
  E2B_TEMPLATE_ID: z.string().optional(),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
