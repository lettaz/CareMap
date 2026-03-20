import { apiFetch } from "./client";

export interface ConversationDTO {
  id: string;
  project_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessageDTO {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls: unknown[] | null;
  created_at: string;
}

export function fetchConversations(projectId: string): Promise<ConversationDTO[]> {
  return apiFetch<ConversationDTO[]>(`/api/projects/${projectId}/conversations`);
}

export function createConversation(
  projectId: string,
  title?: string,
): Promise<ConversationDTO> {
  return apiFetch<ConversationDTO>(`/api/projects/${projectId}/conversations`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function fetchMessages(
  conversationId: string,
): Promise<ConversationMessageDTO[]> {
  return apiFetch<ConversationMessageDTO[]>(
    `/api/projects/conversations/${conversationId}/messages`,
  );
}

export function approveToolCall(
  conversationId: string,
  toolCallId: string,
  approved: boolean,
  feedback?: string,
): Promise<{ approved: boolean; toolCallId: string }> {
  return apiFetch(`/api/projects/conversations/${conversationId}/approve`, {
    method: "POST",
    body: JSON.stringify({ toolCallId, approved, feedback }),
  });
}
