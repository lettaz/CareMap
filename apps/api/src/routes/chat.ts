import type { FastifyPluginAsync } from "fastify";
import type { UIMessage } from "ai";
import { pipeAgentUIStreamToResponse } from "ai";
import { z } from "zod";
import { buildSystemPrompt, createAgent } from "../services/agent.js";
import { ValidationError } from "../lib/errors.js";
import { env } from "../config/env.js";

const chatRequestSchema = z
  .object({
    projectId: z.string().min(1),
    messages: z.array(z.object({ role: z.string() }).passthrough()).min(1),
  })
  .passthrough();

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

    const { projectId, messages } = parsed.data;

    const systemPrompt = await buildSystemPrompt(projectId);
    const agent = createAgent(systemPrompt);

    reply.hijack();

    await pipeAgentUIStreamToResponse({
      response: reply.raw,
      agent,
      uiMessages: messages as unknown as UIMessage[],
      headers: {
        "Access-Control-Allow-Origin": env.CORS_ORIGIN,
        "Access-Control-Allow-Credentials": "true",
      },
    });
  });
};
