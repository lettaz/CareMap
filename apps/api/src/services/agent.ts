import { streamText, ToolLoopAgent, stepCountIs, createAgentUIStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { getModel } from "../config/ai.js";
import { allTools, pipelineTools, sharedTools } from "./tools/index.js";
import { getSemanticContext } from "./semantic.js";

type AgentMode = "pipeline" | "conversation";

const BASE_SYSTEM_PROMPT = `You are CareMap AI, an intelligent assistant for healthcare data harmonization.

You operate in two modes:
1. **Pipeline mode**: You act as a data engineer — profiling, cleaning, mapping, and harmonizing clinical datasets.
2. **Conversation mode**: You act as a data analyst — querying harmonized data, generating visualizations, and explaining lineage.

Key behaviors:
- Always show your reasoning. Reference specific tables, columns, and data sources.
- Column names in source data may be in German — translate and explain.
- For chart suggestions, use the generate_artifact tool.
- For destructive operations (cleaning, harmonizing), explain what you plan to do before executing.
- When querying data, write DuckDB SQL for structured queries or pandas for complex analytics.
`;

async function buildSystemPrompt(projectId: string, mode: AgentMode): Promise<string> {
  const ctx = await getSemanticContext(projectId);

  const sections = [BASE_SYSTEM_PROMPT];

  sections.push(`\n## Project: ${ctx.projectName}`);
  if (ctx.projectDescription) {
    sections.push(`Description: ${ctx.projectDescription}`);
  }

  if (ctx.sources.length > 0) {
    sections.push("\n## Source Files");
    for (const s of ctx.sources) {
      sections.push(`- ${s.filename} (${s.rowCount ?? "?"} rows, status: ${s.status})`);
      if (s.columns.length > 0) {
        const colList = s.columns.map((c) => `${c.name} [${c.type}${c.semanticLabel ? `: ${c.semanticLabel}` : ""}]`).join(", ");
        sections.push(`  Columns: ${colList}`);
      }
    }
  }

  if (ctx.mappings.length > 0) {
    sections.push("\n## Field Mappings");
    for (const m of ctx.mappings) {
      sections.push(`- ${m.sourceFile}.${m.sourceColumn} → ${m.targetTable}.${m.targetColumn} (${m.status}, ${Math.round(m.confidence * 100)}%)`);
    }
  }

  if (ctx.entities.length > 0) {
    sections.push("\n## Harmonized Tables (Parquet)");
    for (const e of ctx.entities) {
      const entityFields = ctx.fields.filter((f) => f.entity_id === e.id);
      sections.push(`- ${e.entity_name}: ${e.row_count ?? "?"} rows @ ${e.parquet_path}`);
      if (entityFields.length > 0) {
        sections.push(`  Columns: ${entityFields.map((f) => f.field_name).join(", ")}`);
      }
    }
  }

  if (ctx.joins.length > 0) {
    sections.push("\n## Detected Joins");
    for (const j of ctx.joins) {
      const from = ctx.entities.find((e) => e.id === j.from_entity_id);
      const to = ctx.entities.find((e) => e.id === j.to_entity_id);
      sections.push(`- ${from?.entity_name ?? "?"} ↔ ${to?.entity_name ?? "?"} ON ${j.join_column}`);
    }
  }

  if (ctx.pipelineNodes.length > 0) {
    sections.push("\n## Pipeline State");
    for (const n of ctx.pipelineNodes) {
      sections.push(`- [${n.node_type}] ${n.label} (${n.status})`);
    }
  }

  if (ctx.alerts.length > 0) {
    sections.push("\n## Active Quality Alerts");
    for (const a of ctx.alerts) {
      sections.push(`- [${a.severity}] ${a.summary}`);
    }
  }

  if (mode === "pipeline") {
    sections.push("\n## Mode: Pipeline\nYou have access to pipeline tools for profiling, cleaning, mapping, and harmonizing data.");
  } else {
    sections.push("\n## Mode: Conversation\nYou have access to analyst tools for querying data, generating charts, and explaining lineage. You can also access pipeline tools if the user needs to modify their pipeline.");
  }

  return sections.join("\n");
}

function getToolsForMode(mode: AgentMode) {
  if (mode === "pipeline") {
    return { ...pipelineTools, ...sharedTools };
  }
  return allTools;
}

export function createAgent(_projectId: string, mode: AgentMode, systemPrompt: string) {
  const tools = getToolsForMode(mode);

  return new ToolLoopAgent({
    model: getModel(),
    instructions: systemPrompt,
    tools,
    stopWhen: stepCountIs(20),
  });
}

export interface AgentStreamOptions {
  projectId: string;
  mode: AgentMode;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}

export async function createAgentStreamResponse(opts: AgentStreamOptions): Promise<Response> {
  const systemPrompt = await buildSystemPrompt(opts.projectId, opts.mode);
  const agent = createAgent(opts.projectId, opts.mode, systemPrompt);

  const uiMessages: UIMessage[] = opts.messages.map((m, i) => ({
    id: `msg-${i}`,
    role: m.role === "system" ? "user" : m.role,
    content: m.content,
    parts: [{ type: "text" as const, text: m.content }],
  }));

  return createAgentUIStreamResponse({
    agent,
    uiMessages,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createSimpleStream(opts: AgentStreamOptions): Promise<any> {
  const systemPrompt = await buildSystemPrompt(opts.projectId, opts.mode);
  const tools = getToolsForMode(opts.mode);

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages: opts.messages,
    tools,
    stopWhen: stepCountIs(20),
    temperature: 0.3,
  });

  return result;
}
