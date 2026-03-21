import { apiFetch } from "./client";

export interface WebhookDTO {
  id: string;
  project_id: string;
  node_id: string;
  name: string;
  api_key: string;
  hmac_secret: string | null;
  payload_type: "json" | "file" | "both";
  is_active: boolean;
  created_at: string;
  last_triggered_at: string | null;
  trigger_count: number;
}

export interface CreateWebhookPayload {
  name: string;
  nodeId: string;
  payloadType?: "json" | "file" | "both";
  enableHmac?: boolean;
}

export function fetchWebhooks(projectId: string): Promise<WebhookDTO[]> {
  return apiFetch(`/api/projects/${projectId}/webhooks`);
}

export function fetchWebhook(projectId: string, id: string): Promise<WebhookDTO> {
  return apiFetch(`/api/projects/${projectId}/webhooks/${id}`);
}

export function createWebhook(projectId: string, payload: CreateWebhookPayload): Promise<WebhookDTO> {
  return apiFetch(`/api/projects/${projectId}/webhooks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateWebhook(
  projectId: string,
  id: string,
  payload: { name?: string; isActive?: boolean; rotateApiKey?: boolean; rotateHmacSecret?: boolean },
): Promise<WebhookDTO> {
  return apiFetch(`/api/projects/${projectId}/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteWebhook(projectId: string, id: string): Promise<void> {
  return apiFetch(`/api/projects/${projectId}/webhooks/${id}`, { method: "DELETE" });
}
