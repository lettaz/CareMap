import type { FastifyPluginAsync } from "fastify";
import { harmonizeSchema } from "../lib/types/api.js";
import { harmonize } from "../services/harmonizer.js";
import { ValidationError } from "../lib/errors.js";

export const harmonizeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request) => {
    const parsed = harmonizeSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

    return harmonize(parsed.data.mappingIds, parsed.data.sourceFileId);
  });
};
