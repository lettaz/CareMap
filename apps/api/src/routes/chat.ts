import type { FastifyPluginAsync } from "fastify";
import { chatRequestSchema } from "../lib/types/api.js";
import { streamChatResponse } from "../services/agent.js";
import { ValidationError } from "../lib/errors.js";

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

    const stream = await streamChatResponse(parsed.data.projectId, parsed.data.messages);

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stream failed";
      reply.raw.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
    }

    reply.raw.end();
  });
};
