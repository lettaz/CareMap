import type { FastifyPluginAsync } from "fastify";
import { getSemanticContext } from "../services/semantic.js";
import { ValidationError } from "../lib/errors.js";

export const semanticRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { projectId: string } }>("/:projectId/semantic", async (request) => {
    const { projectId } = request.params;
    if (!projectId) throw new ValidationError("projectId is required");

    return getSemanticContext(projectId);
  });
};
