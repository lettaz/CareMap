import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import { projectRoutes } from "./routes/projects.js";
import { ingestRoutes } from "./routes/ingest.js";
import { mappingRoutes } from "./routes/mappings.js";
import { harmonizeRoutes } from "./routes/harmonize.js";
import { chatRoutes } from "./routes/chat.js";
import { dashboardRoutes } from "./routes/dashboard.js";

const app = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    transport:
      env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
        : undefined,
  },
});

await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
    });
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  app.log.error(error);
  return reply.status(500).send({
    error: "INTERNAL_ERROR",
    message: env.NODE_ENV === "production" ? "Internal server error" : message,
  });
});

await app.register(projectRoutes, { prefix: "/api/projects" });
await app.register(ingestRoutes, { prefix: "/api/ingest" });
await app.register(mappingRoutes, { prefix: "/api/mappings" });
await app.register(harmonizeRoutes, { prefix: "/api/harmonize" });
await app.register(chatRoutes, { prefix: "/api/chat" });
await app.register(dashboardRoutes, { prefix: "/api/dashboard" });

app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`CareMap API running on http://${env.HOST}:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
