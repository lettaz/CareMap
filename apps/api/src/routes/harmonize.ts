import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { harmonize } from "../services/harmonizer.js";
import { ValidationError } from "../lib/errors.js";

const harmonizeBodySchema = z.object({
  projectId: z.string().uuid(),
  mappingIds: z.array(z.string().uuid()).min(1),
});

export const harmonizeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const parsed = harmonizeBodySchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    try {
      const result = await harmonize(parsed.data.projectId, parsed.data.mappingIds, (line) => {
        reply.raw.write(`data: ${JSON.stringify({ type: "progress", data: { message: line } })}\n\n`);
      });

      reply.raw.write(`data: ${JSON.stringify({ type: "complete", data: result })}\n\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Harmonization failed";
      reply.raw.write(`data: ${JSON.stringify({ type: "error", data: { message } })}\n\n`);
    }

    reply.raw.end();
  });
};
