import { ai, getModelId } from "../config/ai.js";
import { supabase } from "../config/supabase.js";
import { AIServiceError } from "../lib/errors.js";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const SYSTEM_PROMPT = `You are CareMap AI, an intelligent assistant for healthcare data harmonization.

You help users:
1. Profile and understand uploaded clinical datasets
2. Map source fields to a canonical clinical data model
3. Query and analyze harmonized data
4. Investigate data quality issues and anomalies

You have access to these tools:
- executeSQL: Run SQL queries against the harmonized data store
- explainLineage: Trace any field back to its source file and mapping
- runQualityCheck: Assess data quality for a table or source

When answering analytical questions:
1. First determine which tables and joins are needed
2. Write and execute the SQL query
3. Summarize the results in plain language
4. Suggest a chart type if the data is suitable for visualization

Always show your reasoning. Reference specific tables, columns, and data sources.
Column names in source data may be in German — translate and explain.

For chart suggestions, return a JSON block with:
{ "type": "bar|line|pie", "title": "...", "xKey": "...", "yKey": "...", "data": [...] }`;

export async function streamChatResponse(
  projectId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<ReadableStream<Uint8Array>> {
  const semanticContext = await buildSemanticContext(projectId);

  const systemMessages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Current project semantic layer:\n${semanticContext}` },
  ];

  const chatMessages: ChatMessage[] = messages.map((m) => ({
    role: m.role === "agent" ? "assistant" : (m.role as "user" | "assistant"),
    content: m.content,
  }));

  const response = await ai.chat.completions.create({
    model: getModelId(),
    messages: [...systemMessages, ...chatMessages],
    stream: true,
    temperature: 0.3,
  });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            const sseData = `data: ${JSON.stringify({ type: "text_delta", content })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream failed";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`));
        controller.close();
      }
    },
  });
}

async function buildSemanticContext(projectId: string): Promise<string> {
  const { data: entities } = await supabase
    .from("semantic_entities")
    .select("entity_name, description, sql_table_name")
    .eq("project_id", projectId);

  if (!entities?.length) {
    return "No semantic entities defined yet. The user has not harmonized any data.";
  }

  type EntityRow = { entity_name: string; description: string | null; sql_table_name: string };
  const lines = (entities as EntityRow[]).map(
    (e) => `- ${e.entity_name} (table: ${e.sql_table_name}): ${e.description ?? "No description"}`,
  );

  return `Available entities:\n${lines.join("\n")}`;
}

export async function executeProjectSQL(
  projectId: string,
  sql: string,
): Promise<{ rows: Record<string, unknown>[]; rowCount: number; executionTimeMs: number }> {
  const start = Date.now();

  // Validate: only SELECT queries allowed
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT")) {
    throw new AIServiceError("Only SELECT queries are allowed");
  }

  // TODO: In production, use a Supabase RPC function for sandboxed read-only queries.
  // For the prototype, we execute directly via the Supabase client.
  const { data, error } = await supabase.rpc("execute_readonly_sql", {
    query_text: sql,
    p_project_id: projectId,
  } as Record<string, unknown>);

  if (error) throw new AIServiceError(`SQL execution failed: ${error.message}`);

  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    rows,
    rowCount: rows.length,
    executionTimeMs: Date.now() - start,
  };
}
