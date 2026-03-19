import { supabase } from "../config/supabase.js";
import type { ConversationRow, ConversationMessageRow, ConversationMessageInsert } from "../lib/types/database.js";

export async function createConversation(
  projectId: string,
  title?: string,
): Promise<ConversationRow> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ project_id: projectId, title: title ?? null })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to create conversation: ${error?.message}`);
  return data as ConversationRow;
}

export async function getConversations(projectId: string): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select()
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch conversations: ${error.message}`);
  return (data ?? []) as ConversationRow[];
}

export async function getConversation(conversationId: string): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select()
    .eq("id", conversationId)
    .single();

  if (error) return null;
  return data as ConversationRow;
}

export async function saveMessage(
  conversationId: string,
  message: Omit<ConversationMessageInsert, "conversation_id">,
): Promise<ConversationMessageRow> {
  const { data, error } = await supabase
    .from("conversation_messages")
    .insert({ ...message, conversation_id: conversationId })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to save message: ${error?.message}`);

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return data as ConversationMessageRow;
}

export async function getMessages(
  conversationId: string,
  limit = 100,
): Promise<ConversationMessageRow[]> {
  const { data, error } = await supabase
    .from("conversation_messages")
    .select()
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
  return (data ?? []) as ConversationMessageRow[];
}

export function trimContext(
  messages: ConversationMessageRow[],
  maxTokenEstimate = 100_000,
): ConversationMessageRow[] {
  const estimateTokens = (msg: ConversationMessageRow): number => {
    let text = msg.content ?? "";
    if (msg.tool_calls) text += JSON.stringify(msg.tool_calls);
    if (msg.tool_results) text += JSON.stringify(msg.tool_results);
    return Math.ceil(text.length / 4);
  };

  let totalTokens = 0;
  const result: ConversationMessageRow[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(messages[i]!);
    if (totalTokens + tokens > maxTokenEstimate) break;
    totalTokens += tokens;
    result.unshift(messages[i]!);
  }

  return result;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
  if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
}
