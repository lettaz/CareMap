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
- For the "source" stage, pass specific sourceFileIds to query raw/cleaned files. Tables are named after the original filenames (e.g., bed_sensor_data, care_assessments) — use these exact names in your SQL queries.
- Prefer SQL for simple questions — it is faster and more transparent.

### Response Format
- **Lead with a written insight** summarizing the answer in plain language before showing data.
- When returning tabular results, present them clearly with column context.
- When results lend themselves to visualization (trends, distributions, comparisons), call generate_artifact to produce a chart.
- When the user asks for a download or export, call export_data to produce a CSV with a download link.
- **Do NOT repeat SQL or Python code in your text response.** The UI already shows the executed code inside the tool execution card. Focus your response on interpreting results and delivering insights.

### Charting with generate_artifact
- generate_artifact requires queryResults — an array of row objects.
- You MUST pass the data from your preceding run_query or run_script call. Specifically:
  - From run_query: the result has a "rows" field. Pass that array as queryResults.
  - From run_script: the result has an "output" object with a "result" field. Pass output.result as queryResults.
- NEVER call generate_artifact with an empty queryResults. If the prior tool returned no data, skip charting and explain why.

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

## Self-Healing: Catastrophic Data Loss
When execute_cleaning returns catastrophicDataLoss=true:
1. Do NOT just report the problem and ask the user. You MUST fix it automatically.
2. Read the destructiveSteps array to identify which step(s) caused the massive row drop.
3. Analyze why: a "fillNulls" with strategy="drop" on a mostly-null column will drop nearly all rows; a "castType" followed by dropna will drop rows that failed conversion.
4. Build a corrected action list:
   - For fillNulls drops: switch strategy from "drop" to "median", "mode", or "value" with a sensible placeholder.
   - For castType drops: use errors="coerce" (already the default) and add a fillNulls with strategy="median" or "value" instead of dropping nulls.
   - If a step is simply wrong (e.g., filtering an already-filtered column), remove it entirely.
5. Re-run execute_cleaning with the corrected actions immediately.
6. If the retry ALSO shows catastrophic loss, STOP and report to the user with an explanation of what was tried.
7. After a successful self-healing run, briefly explain what you changed and why.
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
      const cleanedNote = s.hasCleanedVersion ? " [cleaned version available]" : "";
      sections.push(`- ${s.filename} (sourceFileId: ${s.id}, ${s.rowCount ?? "?"} rows, status: ${s.status}${cleanedNote})`);
      if (s.columns.length > 0) {
        const colList = s.columns.map((c) => `${c.name} [${c.type}${c.semanticLabel ? `: ${c.semanticLabel}` : ""}]`).join(", ");
        sections.push(`  Columns: ${colList}`);
      }
    }
  }

  const nodeById = new Map(ctx.pipelineNodes.map((n) => [n.id, n]));
  const downstreamEdges = new Map<string, string[]>();
  for (const e of ctx.edges) {
    const existing = downstreamEdges.get(e.source_node_id) ?? [];
    existing.push(e.target_node_id);
    downstreamEdges.set(e.source_node_id, existing);
  }

  if (ctx.pipelineNodes.length > 0) {
    sections.push("\n## Pipeline Graph");
    sections.push("Each node has a unique nodeId. Pass it to tools when operating on a specific node.\n");
    for (const n of ctx.pipelineNodes) {
      const config = n.config as Record<string, unknown> | null;
      const sourceFileId = config?.sourceFileId as string | undefined;
      const extras: string[] = [];
      if (sourceFileId) extras.push(`fileId: ${sourceFileId}`);
      extras.push(`status: ${n.status}`);

      const targets = downstreamEdges.get(n.id) ?? [];
      const targetLabels = targets
        .map((tid) => nodeById.get(tid))
        .filter(Boolean)
        .map((t) => `${t!.label} (${t!.id})`);

      sections.push(`- [${n.node_type}] "${n.label}" (nodeId: ${n.id}, ${extras.join(", ")})`);
      if (targetLabels.length > 0) {
        sections.push(`  → connects to: ${targetLabels.join(", ")}`);
      }

      const nodeMappings = ctx.mappings.filter((m) => m.nodeId === n.id);
      if (nodeMappings.length > 0) {
        const accepted = nodeMappings.filter((m) => m.status === "accepted").length;
        sections.push(`  Mappings: ${nodeMappings.length} total, ${accepted} accepted`);
      }

      const nodeEntities = ctx.entities.filter((e) => e.node_id === n.id);
      if (nodeEntities.length > 0) {
        sections.push(`  Harmonized tables:`);
        for (const e of nodeEntities) {
          const entityFields = ctx.fields.filter((f) => f.entity_id === e.id);
          sections.push(`    - ${e.entity_name}: ${e.row_count ?? "?"} rows [${entityFields.map((f) => f.field_name).join(", ")}]`);
        }
      }
    }
  }

  const unownedEntities = ctx.entities.filter((e) => !e.node_id);
  if (unownedEntities.length > 0) {
    sections.push("\n## Harmonized Tables (project-level)");
    for (const e of unownedEntities) {
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

  if (ctx.alerts.length > 0) {
    sections.push("\n## Active Quality Alerts");
    for (const a of ctx.alerts) {
      sections.push(`- [${a.severity}] ${a.summary}`);
    }
  }

  sections.push(
    "\n## Available Tools\n" +
    "You have all pipeline and analyst tools. Use whichever tools are appropriate for the user's request.\n" +
    "Pipeline: parse_file, profile_columns, suggest_cleaning, execute_cleaning, propose_target_schema, propose_mappings, confirm_mappings, generate_harmonization_script, execute_harmonization_script, run_harmonization\n" +
    "Analyst: run_query, run_script, generate_artifact, explain_lineage, export_data\n" +
    "Shared: run_quality_check, update_semantic_layer\n\n" +
    "## Node-Scoped Operations\n" +
    "Each pipeline node has a unique nodeId visible in the Pipeline Graph above. " +
    "Always pass the correct nodeId when calling tools that accept it:\n" +
    "- propose_target_schema: pass the Transform node's ID as nodeId\n" +
    "- propose_mappings: pass the Transform node's ID as nodeId\n" +
    "- generate_harmonization_script: pass the Harmonize node's ID as nodeId\n" +
    "- execute_harmonization_script: pass the Harmonize node's ID as nodeId\n" +
    "- run_query / run_script (harmonized stage): pass the Harmonize node's ID as nodeId\n" +
    "- run_quality_check: pass the Quality node's ID as nodeId, and the upstream Harmonize node's ID as harmonizeNodeId\n\n" +
    "## Schema Evolution Flow\n" +
    "When a new source is connected and an active schema already exists for that transform node:\n" +
    '1. Call propose_target_schema with mode="extend", the transform nodeId, and the NEW source file IDs.\n' +
    "2. The tool compares the new source profiles against the existing schema and proposes ADDITIVE changes only.\n" +
    '3. If status="no_changes", the existing schema covers the new data — proceed to propose_mappings.\n' +
    "4. If a new schema version is proposed, present what was added and tell the user to activate it.\n" +
    "5. Existing accepted mappings from previous sources are always preserved.\n\n" +
    "## Harmonization Flow\n" +
    "When the user asks to harmonize data, follow this two-step flow:\n" +
    "1. Call generate_harmonization_script with the Harmonize nodeId. The tool resolves upstream transforms and their schemas/mappings automatically.\n" +
    "2. Present the script to the user and explain what it does.\n" +
    "3. Call execute_harmonization_script with the same nodeId and the generated script. This requires user approval.\n" +
    "Do NOT use run_harmonization for new harmonizations — it uses a legacy deterministic approach. " +
    "Only use run_harmonization as a fallback if the AI-generated script fails repeatedly.",
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
