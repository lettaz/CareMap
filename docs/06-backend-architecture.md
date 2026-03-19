# CareMap — Backend Architecture (Revised)

**Version:** 2.0 · March 2026

---

## 1. Design Philosophy

CareMap's backend follows a **native-first execution model**. Every data operation — parsing, profiling, cleaning, mapping, transformation — runs as native TypeScript in the Fastify process or as SQL in Supabase before considering external sandboxes.

| Priority | Execution Tier | When to Use |
|----------|---------------|-------------|
| **1st** | Native TypeScript (Fastify process) | File parsing, statistical profiling, row transforms, type coercion |
| **2nd** | Supabase SQL / RPC | Querying harmonized store, aggregations, quality checks, joins |
| **3rd** | LLM Inference (Vercel AI SDK) | Semantic interpretation, mapping proposals, reasoning, chat |
| **4th** | Sandboxed Execution (E2B) | Complex statistical analysis, user-requested custom scripts, pandas-level operations |

The principle: **deterministic TypeScript and SQL for the 90% case, LLM for reasoning, sandbox only as an escape hatch.**

---

## 2. System Architecture

```
User (Browser)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│              apps/web — Vite + React 19 SPA                 │
│  ├── Flow Canvas (ReactFlow 12)                             │
│  ├── Agent Panel (Zeit AI-style conversation UI)            │
│  ├── Dashboard (composed from pinned chat artifacts)        │
│  └── Settings (model config, project prefs)                 │
└──────────────┬──────────────────────────────────────────────┘
               │  REST + SSE (Vercel AI SDK data stream)
               ▼
┌─────────────────────────────────────────────────────────────┐
│              apps/api — Fastify 5 + TypeScript              │
│                                                             │
│  ┌─── Vercel AI SDK 6 ──────────────────────────────────┐  │
│  │                                                       │  │
│  │  ToolLoopAgent (single contextual agent)              │  │
│  │  ├─ Context: project metadata, profiles, mappings,    │  │
│  │  │           semantic layer, pipeline state            │  │
│  │  │                                                    │  │
│  │  ├─ Pipeline Tools (node-triggered)                   │  │
│  │  │  ├─ parse_file           (auto, native TS)         │  │
│  │  │  ├─ profile_columns      (auto, native TS + LLM)   │  │
│  │  │  ├─ suggest_cleaning     (auto, LLM)               │  │
│  │  │  ├─ execute_cleaning     (approval, native TS)     │  │
│  │  │  ├─ propose_mappings     (auto, LLM)               │  │
│  │  │  ├─ confirm_mappings     (approval, native TS)     │  │
│  │  │  └─ run_harmonization    (approval, native TS)     │  │
│  │  │                                                    │  │
│  │  ├─ Analyst Tools (chat-triggered)                    │  │
│  │  │  ├─ run_query            (auto, Supabase SQL)      │  │
│  │  │  ├─ generate_artifact    (auto, LLM → chart spec)  │  │
│  │  │  ├─ explain_lineage      (auto, Supabase SQL)      │  │
│  │  │  └─ run_analysis_script  (approval, E2B sandbox)   │  │
│  │  │                                                    │  │
│  │  └─ Shared Tools                                      │  │
│  │     ├─ run_quality_check    (auto, native TS + SQL)   │  │
│  │     └─ update_semantic_layer(auto, Supabase)          │  │
│  │                                                       │  │
│  │  Streaming: createUIMessageStream                     │  │
│  │  Events: onToolCallStart, onToolCallFinish,           │  │
│  │          onStepFinish                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Native Processing Layer ──────────────────────────┐  │
│  │  PapaParse        → CSV parsing                       │  │
│  │  xlsx / exceljs   → Excel parsing                     │  │
│  │  TypeScript fns   → Stats, type detection, transforms │  │
│  │  Zod              → Schema validation                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Data Layer ───────────────────────────────────────┐  │
│  │  Supabase (Postgres + Storage + Realtime)             │  │
│  │  ├── Raw files (storage bucket)                       │  │
│  │  ├── Source profiles, field mappings                   │  │
│  │  ├── Canonical tables (harmonized store)               │  │
│  │  ├── Semantic layer (entities, fields, joins)          │  │
│  │  ├── Pipeline state (nodes, edges)                     │  │
│  │  ├── Conversation history                              │  │
│  │  ├── Pinned artifacts / project settings               │  │
│  │  └── Quality alerts                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Sandbox (E2B) — Escape Hatch Only ────────────────┐  │
│  │  Activated when:                                      │  │
│  │  ├── User explicitly asks for statistical analysis    │  │
│  │  ├── Agent determines native TS can't handle it       │  │
│  │  │   (e.g., time series decomposition, clustering)    │  │
│  │  └── User writes custom script in chat                │  │
│  │                                                       │  │
│  │  Python 3.13 + pandas + numpy + scipy                 │  │
│  │  Fully isolated, receives data slice, returns results │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The Agent System

### 3.1 Single Contextual Agent

CareMap uses one AI agent per project with two behavioral modes determined by trigger, not configuration:

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Pipeline** | Node action (upload, connect, run) | Data engineer — profiles, cleans, maps, transforms |
| **Conversation** | Chat input from user | Data analyst — queries store, generates artifacts, explains lineage |

Same `ToolLoopAgent` instance, same tool set, same semantic context. The system prompt adapts a preamble based on the trigger type.

### 3.2 Vercel AI SDK 6 Integration

The `ToolLoopAgent` replaces all manual SSE streaming. It handles:

- Multi-step tool execution loops (up to 20 steps per invocation)
- Tool approval gates (`needsApproval: true`)
- Real-time event streaming to the frontend
- Automatic retry and error recovery within the loop

```
Agent receives trigger
  → Assembles system prompt + semantic context
  → Enters tool loop
  → Calls tools (auto-approved run immediately, approval-required pause)
  → Streams events for each step via createUIMessageStream
  → Loop ends when agent determines task is complete
```

### 3.3 Tool Definitions

#### Pipeline Tools

| Tool | Approval | Execution | Description |
|------|----------|-----------|-------------|
| `parse_file` | auto | Native TS | Parse CSV/Excel with PapaParse/xlsx. Returns column list, row count, sample rows, detected encoding. |
| `profile_columns` | auto | Native TS + LLM | **Phase 1 (Native):** Compute null rates, unique counts, min/max, type distribution, value frequency per column. **Phase 2 (LLM):** Interpret statistics — assign semantic labels, clinical domains, quality flags. |
| `suggest_cleaning` | auto | LLM | Given profiles, propose a cleaning plan: actions per column (fill nulls, parse dates, normalize codes, deduplicate). Returns structured plan, not code. |
| `execute_cleaning` | **approval** | Native TS | Apply the approved cleaning plan using deterministic TypeScript functions: date parser, null handler, string normalizer, deduplicator. Operates on in-memory rows. |
| `propose_mappings` | auto | LLM | Given cleaned profiles + canonical schema, propose source→target column mappings with confidence scores, reasoning, and any required transformations. |
| `confirm_mappings` | **approval** | Native TS | Write accepted mappings to `field_mappings` table. Auto-accept mappings above confidence threshold (configurable, default 0.85). |
| `run_harmonization` | **approval** | Native TS + SQL | Read approved mappings, transform source rows (rename, cast, apply transformation expressions), batch insert into canonical tables. Fully deterministic. |

#### Analyst Tools

| Tool | Approval | Execution | Description |
|------|----------|-----------|-------------|
| `run_query` | auto | Supabase SQL | Execute read-only SQL against the harmonized store. Agent writes the SQL based on semantic context. Scoped to project via `WHERE project_id = ?`. |
| `generate_artifact` | auto | LLM | Given query results, generate a chart specification (type, axes, data). Emitted as a structured data part for the frontend to render with shadcn/Recharts. |
| `explain_lineage` | auto | Supabase SQL | Trace any target column back through `field_mappings` → `source_profiles` → `source_files`. Returns the full provenance chain. |
| `run_analysis_script` | **approval** | E2B Sandbox | For complex analytics (correlations, regressions, time series) that native TS can't handle. Agent writes Python, user approves, runs in isolated E2B sandbox. |

#### Shared Tools

| Tool | Approval | Execution | Description |
|------|----------|-----------|-------------|
| `run_quality_check` | auto | Native TS + SQL | Post-harmonization validation: null rates, range checks, referential integrity, duplicate detection. Generates `quality_alerts` rows. |
| `update_semantic_layer` | auto | Supabase | After harmonization, write/update `semantic_entities`, `semantic_fields`, and `semantic_joins` so the chat agent has accurate project knowledge. |

### 3.4 Semantic Context Assembly

Before every agent invocation, the backend assembles the project's full knowledge into the system prompt:

```
1. Project metadata (name, description, created)
2. Source files (filename, row count, column count, status)
3. Source profiles (column → type, semantic label, domain, quality flags)
4. Field mappings (source → target, status, confidence, transformation)
5. Semantic entities (canonical tables available for querying)
6. Semantic joins (how tables relate)
7. Pipeline state (which nodes exist, their status)
8. Recent quality alerts (unacknowledged issues)
```

This context is what enables the chat agent to translate natural language questions into accurate SQL queries without needing a separate retrieval system.

---

## 4. Native Processing Layer

### 4.1 File Parsing

| Format | Library | Notes |
|--------|---------|-------|
| CSV | PapaParse (already installed) | Header detection, dynamic typing, streaming for large files, delimiter auto-detection |
| Excel (.xlsx) | `xlsx` or `exceljs` (to add) | Sheet selection, header row detection, formula evaluation |
| JSON (future) | Native `JSON.parse` | For API-sourced datasets |

All parsing runs synchronously in the Fastify process. For files > 50MB, PapaParse streams rows in chunks.

### 4.2 Statistical Profiling (Native TypeScript)

The profiler computes per-column statistics **without** the LLM:

```typescript
interface ColumnStats {
  columnName: string;
  totalRows: number;
  nullCount: number;
  nullRate: number;
  uniqueCount: number;
  uniqueRate: number;
  detectedType: "string" | "number" | "date" | "boolean" | "mixed";
  min: string | number | null;
  max: string | number | null;
  mean: number | null;          // numeric columns only
  median: number | null;        // numeric columns only
  stdDev: number | null;        // numeric columns only
  topValues: Array<{ value: string; count: number }>;  // top 10 by frequency
  sampleValues: unknown[];      // first 5 non-null values
  patterns: string[];           // detected regex patterns (date formats, codes)
}
```

This is pure math — no hallucination risk. The LLM then receives these statistics and interprets them semantically (assigns clinical labels, flags quality issues it understands from domain knowledge).

### 4.3 Cleaning Functions (Native TypeScript)

A library of deterministic, composable cleaning functions:

| Function | Input | Output |
|----------|-------|--------|
| `parseDate(value, format)` | `"12.03.2024"`, `"DD.MM.YYYY"` | `2024-03-12T00:00:00Z` |
| `fillNulls(rows, column, strategy)` | strategy: `mean`, `median`, `mode`, `drop`, `constant` | Rows with nulls handled |
| `normalizeString(value, options)` | `"  Zürich "`, `{ trim, lowercase, removeAccents }` | `"zurich"` |
| `castType(value, targetType)` | `"42"`, `"number"` | `42` |
| `deduplicateRows(rows, keyColumns)` | Rows, `["patient_id", "encounter_date"]` | Deduplicated rows |
| `normalizeCode(value, system)` | `"I10"`, `"ICD-10"` | `"I10"` (validated against known codes) |
| `convertUnit(value, from, to)` | `180`, `"cm"`, `"m"` | `1.80` |
| `extractPattern(value, pattern)` | `"Pat-001-CH"`, `"Pat-(\d+)-(\w+)"` | `{ id: "001", country: "CH" }` |

The LLM proposes **which functions to apply and with what parameters**. It does not generate arbitrary code. The backend executes the proposal using this fixed function library.

### 4.4 Row Transformation (Native TypeScript)

Harmonization is fully deterministic:

```
For each source file:
  1. Load cleaned rows from memory/storage
  2. Group field_mappings by target_table
  3. For each target table:
     a. For each source row:
        - Create target row object
        - For each mapping: targetRow[mapping.target_column] = applyTransform(sourceRow[mapping.source_column], mapping.transformation)
        - Add project_id, source_file_id for provenance
     b. Batch insert into canonical table (500 rows per batch)
     c. Record row count, errors
  4. Run post-harmonization quality checks
  5. Update semantic layer
```

No LLM involved. No sandbox needed. Pure column remapping + type casting + expression evaluation.

---

## 5. Pipeline Flows (Per Node Type)

### 5.1 Source Node: Ingest → Profile → Clean

```
User uploads file to source node
    │
    ▼
┌─ parse_file (auto, native) ─────────────────────────────┐
│  PapaParse/xlsx reads file                               │
│  → Streams: "Parsing... 50,234 rows detected"            │
│  → Returns: columns, rowCount, sampleRows, encoding      │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ profile_columns (auto, native + LLM) ──────────────────┐
│  Phase 1 — Native TS:                                    │
│    Compute per-column stats (nulls, uniques, types, etc) │
│    → Streams each column's stats as computed              │
│                                                          │
│  Phase 2 — LLM:                                          │
│    Interpret stats → semantic labels, domains, flags      │
│    → Streams enriched column profiles                     │
│                                                          │
│  Save to: source_profiles, source_files.raw_profile       │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ suggest_cleaning (auto, LLM) ──────────────────────────┐
│  Given: column profiles with quality flags                │
│  Returns: structured cleaning plan                        │
│    [                                                      │
│      { column: "geburtsdatum", action: "parseDate",       │
│        params: { format: "DD.MM.YYYY" }, reason: "..." }, │
│      { column: "patient_id", action: "fillNulls",         │
│        params: { strategy: "drop" }, reason: "..." },     │
│    ]                                                      │
│  → Streams: plan artifact for user review                 │
└──────────────────────────────────────────────────────────┘
    │
    ▼  ← USER APPROVAL GATE
┌─ execute_cleaning (approval, native) ───────────────────┐
│  Apply cleaning functions from the fixed library          │
│  → Streams: per-column progress, before/after samples     │
│  → Stores cleaned data (Supabase Storage or in-memory)    │
│  → Updates source_profiles with post-clean stats          │
│                                                          │
│  Node status: raw → profiling → profiled → cleaning →     │
│               clean                                       │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Mapping Node: Align Sources to Canonical Schema

```
User connects source nodes to mapping node
    │
    ▼
┌─ propose_mappings (auto, LLM) ──────────────────────────┐
│  Input: cleaned profiles from all connected sources       │
│  + canonical schema definition                            │
│  + any existing mappings from prior sources               │
│                                                          │
│  Returns per source column:                               │
│    { sourceColumn, targetTable, targetColumn,             │
│      confidence, reasoning, transformation }              │
│                                                          │
│  Auto-accept: confidence >= 0.85                          │
│  → Streams: mapping table artifact (target-centric view)  │
│  → Streams: orphan columns, join key detection            │
└──────────────────────────────────────────────────────────┘
    │
    ▼  ← USER REVIEW (approve/reject/edit per mapping)
┌─ confirm_mappings (approval, native) ───────────────────┐
│  Write final mapping decisions to field_mappings          │
│  → Streams: confirmation summary                          │
│                                                          │
│  Node status: idle → proposing → proposed → confirmed     │
└──────────────────────────────────────────────────────────┘
```

### 5.3 Output Node: Harmonize to Canonical Store

```
User triggers harmonization on output node
    │
    ▼
┌─ run_harmonization (approval, native + SQL) ────────────┐
│  1. Load cleaned source rows                              │
│  2. Apply confirmed mappings (deterministic transforms)   │
│  3. Batch insert into canonical Supabase tables           │
│     → Streams: progress (X / Y rows written to table Z)  │
│  4. Run referential integrity checks                      │
│  5. Run post-harmonization quality checks                 │
│     → Streams: quality summary, any new alerts            │
│  6. Update semantic layer (entities, fields, joins)       │
│                                                          │
│  Node status: idle → harmonizing → complete               │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─ update_semantic_layer (auto, Supabase) ────────────────┐
│  Write to semantic_entities, semantic_fields,             │
│  semantic_joins based on what was harmonized.             │
│                                                          │
│  This is what the chat agent reads when answering         │
│  questions about the data.                                │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Chat Agent: Querying the Harmonized Store

### 6.1 How It Works

When the user asks a question in the project chat, the agent:

1. Receives the message + full semantic context (assembled per §3.4)
2. Determines which canonical tables and joins are needed
3. Writes a SQL query using the semantic layer
4. Executes via `run_query` tool (Supabase RPC, read-only, project-scoped)
5. Interprets results in plain language
6. Optionally generates a chart artifact via `generate_artifact`

The agent knows every source file, every column, every mapping decision, and every quality issue. It can answer questions like:

- "How many patients had a fall risk score above 3 in Q2 2024?"
- "Which source file contributed the most null values to the encounters table?"
- "Show me the distribution of lab results by test type"
- "What's the correlation between fall risk scores and length of stay?"

For the last example (correlation), the agent would recognize this exceeds native SQL and escalate to `run_analysis_script` (E2B sandbox with user approval).

### 6.2 Query Safety

- Only `SELECT` statements allowed via `run_query`
- All queries are scoped with `WHERE project_id = :projectId`
- Supabase RPC function enforces read-only access
- Query execution has a timeout (10s default)
- Row limit on results (1000 rows default, configurable)

### 6.3 Artifact Generation

When the agent generates a visualization, it emits a structured data part:

```json
{
  "type": "artifact",
  "id": "artifact-uuid",
  "artifactType": "chart",
  "status": "complete",
  "data": {
    "chartType": "bar",
    "title": "Fall Risk Distribution by Ward",
    "xKey": "ward",
    "yKey": "patient_count",
    "data": [
      { "ward": "Station A", "patient_count": 42 },
      { "ward": "Station B", "patient_count": 28 }
    ]
  }
}
```

The frontend renders this inline in the conversation using shadcn/Recharts. The user can then **pin** the artifact to the project dashboard.

---

## 7. Streaming & UX Patterns

### 7.1 Stream Protocol

All agent interactions use the Vercel AI SDK **data stream protocol** over SSE. The frontend consumes via `useChat` or a custom hook wrapping `createUIMessageStream`.

Stream event types:

| Event Type | Description | Frontend Rendering |
|------------|-------------|-------------------|
| `text-delta` | Incremental text from the agent | Appended to message body |
| `tool-call` | Agent is invoking a tool (name + args) | Rendered as a collapsible "ToolStep" |
| `tool-result` | Tool execution completed (result data) | Updates the ToolStep with results |
| `data` | Structured data part (artifact, progress) | Rendered as inline component |
| `error` | Error occurred during processing | Error banner in conversation |
| `finish` | Agent turn complete | Enables user input |

### 7.2 Tool Approval UX

When the agent calls a tool with `needsApproval: true`:

1. The tool call is streamed to the frontend with its arguments
2. The frontend renders an approval block showing:
   - What will happen (e.g., "Clean 23 columns in source_data.csv")
   - The plan/parameters (e.g., cleaning actions table)
   - Approve / Reject buttons
3. The user's decision is sent back to the agent
4. On approval: tool executes, results stream back
5. On rejection: agent acknowledges, asks for guidance

### 7.3 Progress Streaming During Long Operations

For operations like harmonization (thousands of rows), the agent streams progress as transient data parts:

```json
{ "type": "progress", "id": "harmonize-progress", "current": 2500, "total": 50234, "table": "care_assessments" }
```

The frontend renders this as an updating progress bar. Transient parts don't persist in conversation history.

---

## 8. Project Settings & Pinned Artifacts

### 8.1 Project Settings

Each project stores configuration in a `project_settings` JSONB column (to be added to `projects` table):

```json
{
  "autoAcceptThreshold": 0.85,
  "defaultModel": "gpt-4.1",
  "dashboardRefreshInterval": 300,
  "pinnedArtifactIds": ["artifact-1", "artifact-2"],
  "cleaningDefaults": {
    "nullStrategy": "drop",
    "dateFormat": "ISO"
  }
}
```

### 8.2 Dashboard as Pinned Artifacts

The dashboard is not a static page — it is **composed from conversation artifacts** the user pins:

1. User asks a question in chat → agent generates chart artifact
2. User clicks "Pin to Dashboard" on the artifact
3. Backend stores the artifact spec + underlying SQL in `pinned_widgets`
4. Dashboard page renders all pinned widgets for the project
5. Widgets can optionally auto-refresh by re-executing their SQL query

This means the dashboard evolves organically from the user's analytical questions rather than requiring a separate dashboard builder.

---

## 9. Conversation History

### 9.1 Storage

Conversations are stored per-project in a `conversations` table (to be added):

```sql
create table conversations (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table conversation_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  tool_calls      jsonb,
  artifacts       jsonb,
  created_at      timestamptz not null default now()
);
```

### 9.2 Context Window Management

For long conversations, the backend trims older messages while preserving:
- The system prompt (always)
- The semantic context (always, rebuilt fresh)
- The last N user/assistant exchanges (configurable, default 20)
- Any messages containing tool approvals (preserved for audit trail)

---

## 10. Dependency Changes

### Add

| Package | Purpose |
|---------|---------|
| `ai` (Vercel AI SDK 6) | ToolLoopAgent, createUIMessageStream, tool definitions |
| `xlsx` or `exceljs` | Excel file parsing |
| `@e2b/code-interpreter` | Sandboxed Python execution (escape hatch only) |

### Keep

| Package | Purpose |
|---------|---------|
| `fastify`, `@fastify/cors`, `@fastify/multipart` | HTTP server, CORS, file uploads |
| `@supabase/supabase-js` | Database client |
| `papaparse` | CSV parsing |
| `zod` | Request validation, schema definitions |
| `dotenv`, `tsx`, `typescript` | Dev tooling |

### Remove

| Package | Reason |
|---------|--------|
| `openai` | Replaced by Vercel AI SDK (which wraps OpenAI, Anthropic, and custom providers) |

### Environment Variables (additions)

```env
# E2B (optional, only needed for sandbox execution)
E2B_API_KEY=e2b_...

# Vercel AI SDK (if using Vercel sandbox instead of E2B)
# VERCEL_OIDC_TOKEN=...
```

---

## 11. Migration from Current Scaffold

The current `apps/api` has the right directory structure. The refactor is incremental:

### Phase 1: Native Profiling

Replace LLM-only profiling with native stats + LLM interpretation.

| File | Change |
|------|--------|
| `services/profiler.ts` | Add `computeColumnStats()` (pure TS). Keep `profileColumns()` but feed it computed stats instead of raw samples. |
| `routes/ingest.ts` | No change needed — already streams SSE. Will switch to `createUIMessageStream` in Phase 3. |

### Phase 2: Native Cleaning + Harmonization

Add the deterministic processing layer.

| File | Change |
|------|--------|
| `services/cleaner.ts` | **New.** Cleaning function library: `parseDate`, `fillNulls`, `normalizeString`, `castType`, `deduplicateRows`, `normalizeCode`, `convertUnit`. |
| `services/harmonizer.ts` | Fill in `writeToCanonicalTable()` and `runPostHarmonizationChecks()`. Pure TS row transformation + Supabase batch inserts. |
| `services/semantic.ts` | **New.** `updateSemanticLayer()` — writes to `semantic_entities`, `semantic_fields`, `semantic_joins` after harmonization. |

### Phase 3: Vercel AI SDK Agent

Replace manual SSE + raw OpenAI calls with the AI SDK agent loop.

| File | Change |
|------|--------|
| `config/ai.ts` | Replace `openai` client with Vercel AI SDK provider setup (`createOpenAI`, `createAnthropic`, etc). |
| `services/agent.ts` | Rewrite: define tools as AI SDK `tool()` objects with `needsApproval`, wire into `ToolLoopAgent`. Replace manual `ReadableStream` with `createUIMessageStream`. |
| `routes/chat.ts` | Simplify: pipe `ToolLoopAgent` stream directly to response via `createUIMessageStream`. |
| `routes/ingest.ts` | Optionally convert to agent-driven flow (trigger ToolLoopAgent on upload). |

### Phase 4: E2B Sandbox (Escape Hatch)

| File | Change |
|------|--------|
| `services/sandbox.ts` | **New.** Thin wrapper around `@e2b/code-interpreter`. Creates sandbox, sends data slice, executes Python, streams stdout/stderr, returns results. |
| Agent tool definition | Add `run_analysis_script` tool with `needsApproval: true`. |

### Phase 5: Conversation Storage + Artifacts

| File | Change |
|------|--------|
| `supabase/migrations/002_conversations.sql` | **New.** Add `conversations` and `conversation_messages` tables. Add `settings` JSONB column to `projects`. |
| `services/conversation.ts` | **New.** CRUD for conversations, context window trimming, artifact extraction. |
| `routes/dashboard.ts` | Update widget pinning to reference conversation artifacts. |

---

## 12. API Route Changes

### Existing Routes (keep, evolve)

| Route | Current | Evolves To |
|-------|---------|-----------|
| `POST /api/ingest` | Manual SSE + LLM-only profiling | ToolLoopAgent-driven with native stats (Phase 3) |
| `POST /api/chat` | Raw OpenAI streaming | ToolLoopAgent with tools, artifacts, approvals |
| `GET /api/mappings` | Direct Supabase query | No change |
| `POST /api/mappings/generate` | Single LLM call | ToolLoopAgent tool (can be called from chat too) |
| `PATCH /api/mappings/:id` | Direct update | No change |
| `POST /api/harmonize` | Stub | Native TS row transformation + batch insert |
| `GET /api/dashboard` | Direct queries | Add artifact-based widget rendering |
| `CRUD /api/projects` | Direct Supabase | Add `settings` field |

### New Routes

| Route | Purpose |
|-------|---------|
| `POST /api/projects/:id/pipeline/trigger` | Trigger agent for a specific node action (upload, connect, run). Returns SSE stream. |
| `GET /api/projects/:id/conversations` | List conversations for a project |
| `GET /api/conversations/:id/messages` | Get messages for a conversation |
| `POST /api/conversations/:id/approve` | Send approval/rejection for a pending tool call |
| `GET /api/projects/:id/semantic` | Get the semantic layer (entities, fields, joins) |
| `POST /api/projects/:id/artifacts/:id/pin` | Pin a chat artifact to the dashboard |

---

## 13. Database Schema Additions

To be added in `002_conversations.sql`:

```sql
-- Conversation history
create table conversations (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at();

create table conversation_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content         text,
  tool_calls      jsonb,
  tool_results    jsonb,
  artifacts       jsonb,
  created_at      timestamptz not null default now()
);

create index idx_conv_messages_conv on conversation_messages(conversation_id);
create index idx_conversations_project on conversations(project_id);

-- Project settings
alter table projects add column settings jsonb not null default '{}';

-- Cleaned data staging (before harmonization)
create table cleaned_data_cache (
  id             uuid primary key default uuid_generate_v4(),
  source_file_id uuid not null references source_files(id) on delete cascade,
  cleaned_rows   jsonb not null,
  row_count      int not null,
  cleaning_plan  jsonb not null,
  created_at     timestamptz not null default now()
);

create index idx_cleaned_data_source on cleaned_data_cache(source_file_id);

-- Read-only SQL execution function (for chat agent queries)
create or replace function execute_readonly_sql(query_text text, p_project_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  if not (lower(trim(query_text)) like 'select%') then
    raise exception 'Only SELECT queries are allowed';
  end if;

  execute format('select jsonb_agg(row_to_json(t)) from (%s) t', query_text)
    into result;

  return coalesce(result, '[]'::jsonb);
end;
$$;
```

---

## 14. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| LLM writes dangerous SQL | `execute_readonly_sql` only allows `SELECT`. Runs as `security definer` with read-only permissions. |
| LLM proposes bad cleaning | Cleaning uses a **fixed function library** — the LLM chooses functions and parameters, it does not generate arbitrary code. |
| E2B sandbox escape | E2B uses Firecracker microVMs with hardware-level isolation. Sandbox receives a data slice, not database credentials. |
| HIPAA / clinical data | Supabase is SOC 2 Type II. E2B is SOC 2 Type II. For production: encrypt data at rest, audit all access, consider self-hosted sandbox. |
| Conversation data leak | Conversations are scoped to `project_id`. RLS policies (disabled for prototype, required for production) enforce isolation. |
| Tool approval bypass | `needsApproval` is enforced server-side by the AI SDK. The tool does not execute until the approval endpoint is called. |

---

## 15. Performance Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| File parse (CSV, < 50MB) | < 2s | Native PapaParse, streaming |
| Statistical profiling | < 3s for 50k rows, 30 columns | Native TS, single pass |
| LLM semantic interpretation | < 5s | Single structured completion call |
| Cleaning (50k rows) | < 5s | In-memory TS transforms |
| Mapping proposal | < 8s | Single LLM call with full context |
| Harmonization (50k rows, 5 tables) | < 10s | Batch inserts (500 rows/batch) |
| Chat query (SQL) | < 2s | Indexed Supabase tables |
| E2B sandbox cold start | ~150ms | Only used for complex analytics |

---

## 16. Reference Implementations

| Product / Paper | Relevance | Key Takeaway |
|----------------|-----------|--------------|
| **aha (IGC Pharma)** | Production multi-agent clinical data harmonization | 4-step loop: Profile → Plan → Execute → Validate. CareMap follows the same loop but with native execution. |
| **CleanAgent (VLDB 2025)** | LLM + code executor for data standardization | LLM generates code from a fixed API library — same pattern as CareMap's cleaning function library. |
| **OMOP CDM Agentic Architecture (Springer, Jan 2026)** | Declarative modeling with LLM agents for clinical data | "Data engineers become validators, not coders" — CareMap's core thesis. |
| **Amazon SageMaker Data Agent** | Production healthcare data analyst agent | Agent writes SQL/Python from natural language, executes in managed sandbox. Validates CareMap's chat analyst pattern. |
| **Vercel AI SDK 6 ToolLoopAgent** | Production agent framework with tool approval | Built-in `needsApproval`, streaming, multi-step loops — exactly what CareMap's agent needs. |
| **E2B Code Interpreter** | Sandboxed Python execution for AI agents | 150ms cold start, pandas/numpy pre-installed, streaming stdout. CareMap's escape hatch for complex analytics. |
