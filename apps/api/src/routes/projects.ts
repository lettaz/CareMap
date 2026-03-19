import type { FastifyPluginAsync } from "fastify";
import { supabase } from "../config/supabase.js";
import { createProjectSchema } from "../lib/types/api.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => {
    const { data, error } = await supabase
      .from("projects")
      .select()
      .order("updated_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch projects: ${error.message}`);
    return data;
  });

  app.get<{ Params: { id: string } }>("/:id", async (request) => {
    const { id } = request.params;
    const { data, error } = await supabase
      .from("projects")
      .select()
      .eq("id", id)
      .single();

    if (error || !data) throw new NotFoundError("Project", id);
    return data;
  });

  app.post("/", async (request, reply) => {
    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create project: ${error.message}`);
    return reply.status(201).send(data);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const { id } = request.params;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw new NotFoundError("Project", id);
    return reply.status(204).send();
  });
};
