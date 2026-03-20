import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { supabase } from "../config/supabase.js";
import { ValidationError } from "../lib/errors.js";
import { parsePagination, paginationRange, buildPaginatedResponse } from "../lib/pagination.js";

const approvalSchema = z.object({
  toolCallId: z.string(),
  approved: z.boolean(),
  feedback: z.string().optional(),
});

export const conversationRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { projectId: string } }>("/:projectId/conversations", async (request) => {
    const { projectId } = request.params;

    const { data, error } = await supabase
      .from("conversations")
      .select()
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch conversations: ${error.message}`);
    return data ?? [];
  });

  app.post<{ Params: { projectId: string } }>("/:projectId/conversations", async (request, reply) => {
    const { projectId } = request.params;
    const body = request.body as { title?: string } | undefined;

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        project_id: projectId,
        title: body?.title ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create conversation: ${error.message}`);
    return reply.status(201).send(data);
  });

  app.get<{ Params: { conversationId: string }; Querystring: { page?: string; pageSize?: string } }>(
    "/conversations/:conversationId/messages",
    async (request) => {
      const { conversationId } = request.params;
      const pagination = parsePagination(request.query as Record<string, unknown>);
      const { from, to } = paginationRange(pagination);

      const { data, error, count } = await supabase
        .from("conversation_messages")
        .select("*", { count: "exact" })
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .range(from, to);

      if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
      return buildPaginatedResponse(data ?? [], count ?? 0, pagination);
    },
  );

  app.post<{ Params: { conversationId: string } }>(
    "/conversations/:conversationId/approve",
    async (request) => {
      const { conversationId } = request.params;
      const parsed = approvalSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid approval");

      const { toolCallId, approved, feedback } = parsed.data;

      await supabase.from("conversation_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: approved
          ? `Approved tool call ${toolCallId}${feedback ? `: ${feedback}` : ""}`
          : `Rejected tool call ${toolCallId}${feedback ? `: ${feedback}` : ""}`,
        tool_calls: null,
        tool_results: { toolCallId, approved, feedback },
        artifacts: null,
      });

      return { approved, toolCallId, conversationId };
    },
  );
};
