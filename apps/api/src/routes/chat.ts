import type { FastifyPluginAsync } from "fastify";
import type { UIMessage } from "ai";
import { createAgentUIStreamResponse } from "ai";
import { z } from "zod";
import { buildSystemPrompt, createAgent } from "../services/agent.js";
import { ValidationError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { createSanitizedStream } from "../lib/stream-sanitizer.js";

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

    const response = await createAgentUIStreamResponse({
      agent,
      uiMessages: messages as unknown as UIMessage[],
    });

    reply.hijack();

    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": env.CORS_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
    };
    if (response.headers) {
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
    }

    reply.raw.writeHead(response.status ?? 200, headers);

    if (response.body) {
      const sanitized = createSanitizedStream(response.body);
      const reader = sanitized.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(value);
        }
      } catch {
        // Client disconnected
      }
    }

    reply.raw.end();
  });
};
