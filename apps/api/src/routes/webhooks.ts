import type { FastifyPluginAsync } from "fastify";
import crypto from "node:crypto";
import { supabase } from "../config/supabase.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";
import type { WebhookPayloadType } from "../lib/types/database.js";

function generateKey(): string {
  return `whk_${crypto.randomBytes(32).toString("hex")}`;
}

function generateSecret(): string {
  return `whs_${crypto.randomBytes(32).toString("hex")}`;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}${"*".repeat(8)}${key.slice(-4)}`;
}

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Params: { projectId: string };
    Body: { name: string; nodeId: string; payloadType?: WebhookPayloadType; enableHmac?: boolean };
  }>("/:projectId/webhooks", async (request) => {
    const { projectId } = request.params;
    const { name, nodeId, payloadType = "both", enableHmac = true } = request.body ?? {};

    if (!name?.trim()) throw new ValidationError("name is required");
    if (!nodeId?.trim()) throw new ValidationError("nodeId is required");

    const apiKey = generateKey();
    const hmacSecret = enableHmac ? generateSecret() : null;

    const { data, error } = await supabase
      .from("webhooks")
      .insert({
        project_id: projectId,
        node_id: nodeId,
        name: name.trim(),
        api_key: apiKey,
        hmac_secret: hmacSecret,
        payload_type: payloadType,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create webhook: ${error.message}`);

    return {
      ...data,
      api_key: apiKey,
      hmac_secret: hmacSecret,
    };
  });

  app.get<{ Params: { projectId: string } }>("/:projectId/webhooks", async (request) => {
    const { projectId } = request.params;

    const { data, error } = await supabase
      .from("webhooks")
      .select()
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to list webhooks: ${error.message}`);

    return (data ?? []).map((w) => ({
      ...w,
      api_key: maskKey(w.api_key),
      hmac_secret: w.hmac_secret ? maskKey(w.hmac_secret) : null,
    }));
  });

  app.get<{ Params: { projectId: string; id: string } }>(
    "/:projectId/webhooks/:id",
    async (request) => {
      const { projectId, id } = request.params;

      const { data, error } = await supabase
        .from("webhooks")
        .select()
        .eq("id", id)
        .eq("project_id", projectId)
        .single();

      if (error || !data) throw new NotFoundError("Webhook", id);

      return {
        ...data,
        api_key: maskKey(data.api_key),
        hmac_secret: data.hmac_secret ? maskKey(data.hmac_secret) : null,
      };
    },
  );

  app.patch<{
    Params: { projectId: string; id: string };
    Body: { name?: string; isActive?: boolean; rotateApiKey?: boolean; rotateHmacSecret?: boolean };
  }>("/:projectId/webhooks/:id", async (request) => {
    const { projectId, id } = request.params;
    const { name, isActive, rotateApiKey, rotateHmacSecret } = request.body ?? {};

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (isActive !== undefined) updates.is_active = isActive;
    if (rotateApiKey) updates.api_key = generateKey();
    if (rotateHmacSecret) updates.hmac_secret = generateSecret();

    if (Object.keys(updates).length === 0) {
      throw new ValidationError("No fields to update");
    }

    const { data, error } = await supabase
      .from("webhooks")
      .update(updates)
      .eq("id", id)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error || !data) throw new NotFoundError("Webhook", id);

    const response: Record<string, unknown> = {
      ...data,
      api_key: rotateApiKey ? data.api_key : maskKey(data.api_key),
      hmac_secret: data.hmac_secret
        ? rotateHmacSecret
          ? data.hmac_secret
          : maskKey(data.hmac_secret)
        : null,
    };

    return response;
  });

  app.delete<{ Params: { projectId: string; id: string } }>(
    "/:projectId/webhooks/:id",
    async (request, reply) => {
      const { projectId, id } = request.params;

      const { error } = await supabase
        .from("webhooks")
        .delete()
        .eq("id", id)
        .eq("project_id", projectId);

      if (error) throw new Error(`Failed to delete webhook: ${error.message}`);
      return reply.status(204).send();
    },
  );
};
