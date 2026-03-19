import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createAgentStreamResponse } from "../services/agent.js";
import { ValidationError } from "../lib/errors.js";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  projectId: z.string().uuid(),
});

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

    const { projectId, messages } = parsed.data;

    const response = await createAgentStreamResponse({
      projectId,
      messages,
    });

    const status = response.status;
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    reply.raw.writeHead(status, headers);

    if (response.body) {
      const reader = response.body.getReader();
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
