import { ToolLoopAgent, stepCountIs, createAgentUIStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { getModel } from "../config/ai.js";
import { allTools } from "./tools/index.js";
import { getSemanticContext } from "./semantic.js";

const BASE_SYSTEM_PROMPT = `You are CareMap AI, an intelligent assistant for healthcare data harmonization and analysis.

You seamlessly handle both data engineering and data analysis tasks within the same conversation.
Decide what to do based on the user's message — there is no mode switch.

## Data Engineering (Pipeline) Capabilities
When the user uploads files or asks about profiling, cleaning, mapping, or harmonizing:
- Profile columns, propose cleaning plans, propose target schemas, map columns, and run harmonization.
- For destructive operations (cleaning, harmonizing), explain what you plan to do before executing.
- Column names in source data may be in German — translate and explain.

## Data Analysis (Analyst) Capabilities
When the user asks questions about their data, requests insights, or wants visualizations:

### Choosing SQL vs Python
- Use **DuckDB SQL** via run_query (type: "sql") for: aggregations, filtering, grouping, joins, counts, averages, distributions.
- Use **Python/pandas** via run_query (type: "python") for: correlations, pivots, complex reshaping, time-series resampling.
- Use **run_script** for: machine learning (sklearn), statistical tests (scipy.stats), custom models, predictions. The sandbox has pandas, numpy, scipy, and scikit-learn available.

### Query Guidelines
- Always use table and column names from the Harmonized Tables section below. Never guess or hallucinate names.
- Use the Detected Joins section to know which tables can be joined and on which column.
- For the "harmonized" stage, files are loaded as DuckDB tables (SQL) or into a \`dataframes\` dict (Python) matching the entity names.
- For the "source" stage, pass specific sourceFileIds to query raw/cleaned files.
- Prefer SQL for simple questions — it is faster and more transparent.

### Response Format
- **Lead with a written insight** summarizing the answer in plain language before showing data.
- When returning tabular results, present them clearly with column context.
- When results lend themselves to visualization (trends, distributions, comparisons), call generate_artifact to produce a chart.
- When the user asks for a download or export, call export_data to produce a CSV with a download link.
- **Do NOT repeat SQL or Python code in your text response.** The UI already shows the executed code inside the tool execution card. Focus your response on interpreting results and delivering insights.

### Predictions and ML
- When the user asks for predictions, forecasts, risk scoring, or correlation analysis, use run_script.
- The E2B sandbox has scikit-learn pre-installed. You can train models, evaluate them, and return predictions.
- Explain the model choice, features used, and accuracy metrics alongside results.

## General Behaviors
- Always show your reasoning. Reference specific tables, columns, and data sources.
- When explaining data lineage, use explain_lineage to trace a column back to its source.
- Provide actionable insights, not just raw numbers.

## Error Handling
- Tool results include a "success" field. If success is false, read the "error" and "suggestion" fields.
- If "retryable" is true, you MAY retry the same tool call once. If it fails again, report the error to the user.
- Never silently ignore a failed tool result. Always inform the user what happened and what they can do.
- If a tool fails due to missing prerequisites (no schema, no profiles, etc.), guide the user through the required steps.
`;

async function buildSystemPrompt(projectId: string): Promise<string> {
  const ctx = await getSemanticContext(projectId);

  const sections = [BASE_SYSTEM_PROMPT];

  sections.push(`\n## Project: ${ctx.projectName}`);
  sections.push(`Project ID: ${projectId}`);
  sections.push("IMPORTANT: Always use this exact Project ID when calling tools that require a projectId parameter. Never guess or fabricate a UUID.");
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
    sections.push("\n## Harmonized Tables");
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

  sections.push(
    "\n## Available Tools\n" +
    "You have all pipeline and analyst tools. Use whichever tools are appropriate for the user's request.\n" +
    "Pipeline: parse_file, profile_columns, suggest_cleaning, execute_cleaning, propose_target_schema, propose_mappings, confirm_mappings, run_harmonization\n" +
    "Analyst: run_query, run_script, generate_artifact, explain_lineage, export_data\n" +
    "Shared: run_quality_check, update_semantic_layer",
  );

  return sections.join("\n");
}

export function createAgent(systemPrompt: string) {
  return new ToolLoopAgent({
    model: getModel(),
    instructions: systemPrompt,
    tools: allTools,
    stopWhen: stepCountIs(20),
  });
}

export interface AgentStreamOptions {
  projectId: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}

export async function createAgentStreamResponse(opts: AgentStreamOptions): Promise<Response> {
  const systemPrompt = await buildSystemPrompt(opts.projectId);
  const agent = createAgent(systemPrompt);

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

export { buildSystemPrompt };
