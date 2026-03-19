# CareMap — Backend Architecture (Revised)

**Version:** 3.0 · March 2026

---

## 1. Design Philosophy

CareMap's backend separates **metadata** from **data**:

- **Supabase Postgres** stores metadata only — projects, source profiles, field mappings, conversations, pipeline state, quality alerts, semantic layer. Never the actual data rows.
- **Supabase Storage** stores files — raw uploads (CSV/Excel) and harmonized outputs (Parquet).
- **E2B Sandbox** is the execution environment — cleaning, harmonization, and querying all run as Python inside isolated sandboxes with pandas and DuckDB.
- **Native TypeScript** handles lightweight operations — file parsing, statistical profiling, request validation.
- **LLM (Vercel AI SDK 6)** handles reasoning — semantic interpretation, mapping proposals, cleaning plans, chat responses.

### Execution Tiers

| Priority | Tier | What Runs Here |
|----------|------|----------------|
| **1st** | Native TypeScript (Fastify) | File parsing (PapaParse/xlsx), statistical profiling (null rates, distributions), request validation |
| **2nd** | LLM Inference (Vercel AI SDK) | Semantic interpretation, mapping proposals, cleaning plan suggestions, chat reasoning, artifact generation |
| **3rd** | E2B Sandbox (Python) | Data cleaning (pandas), harmonization (pandas → Parquet), querying (DuckDB/pandas → JSON), complex analytics |
| **4th** | Supabase SQL | Metadata queries only — profiles, mappings, conversations, semantic layer, quality alerts |

The principle: **TypeScript for parsing and stats, LLM for reasoning, E2B for all data manipulation, Supabase for metadata persistence.**

---

## 2. Data Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA LIFECYCLE                             │
│                                                              │
│  1. UPLOAD                                                   │
│     User uploads CSV/Excel to source node                    │
│     → Raw file stored in Supabase Storage                    │
│       (storage/raw/{projectId}/{sourceFileId}/data.csv)      │
│                                                              │
│  2. PARSE + PROFILE (Native TypeScript)                      │
│     PapaParse/xlsx reads file in Fastify process              │
│     → Column stats computed (nulls, uniques, types, etc)     │
│     → LLM interprets stats → semantic labels, domains        │
│     → Profiles saved to source_profiles table (metadata)     │
│                                                              │
│  3. CLEAN (E2B Sandbox)                                      │
│     LLM proposes cleaning plan → user approves               │
│     → Sandbox loads raw file from Supabase Storage            │
│     → pandas applies cleaning transforms                      │
│     → Cleaned file written back to Supabase Storage           │
│       (storage/cleaned/{projectId}/{sourceFileId}/data.parquet)│
│     → Updated profiles saved to metadata                      │
│                                                              │
│  4. HARMONIZE (E2B Sandbox)                                  │
│     User approves mappings → triggers harmonization           │
│     → Sandbox loads cleaned Parquet files for all sources     │
│     → pandas applies column renames, type casts, transforms   │
│     → Joins across sources where keys match                   │
│     → Output written as Parquet per target table              │
│       (storage/harmonized/{projectId}/patients.parquet)       │
│       (storage/harmonized/{projectId}/encounters.parquet)     │
│       (storage/harmonized/{projectId}/care_assessments.parquet)│
│     → Semantic layer updated in metadata                      │
│                                                              │
│  5. QUERY (E2B Sandbox)                                      │
│     User asks a question in chat                              │
│     → Sandbox loads harmonized Parquet files                  │
│     → DuckDB or pandas runs the query                         │
│     → Results returned as JSON                                │
│     → Agent formats response + optional chart artifact        │
│                                                              │
│  PERSISTENCE:                                                │
│  ├── Supabase Storage: raw files, cleaned files, Parquet     │
│  └── Supabase Postgres: profiles, mappings, conversations,   │
│       semantic layer, pipeline state, quality alerts          │
│       (NO data rows — metadata only)                         │
└─────────────────────────────────────────────────────────────┘
```

### Supabase Storage Bucket Structure

```
caremap-files/
├── raw/
│   └── {projectId}/
│       └── {sourceFileId}/
│           └── original.csv          ← uploaded file
├── cleaned/
│   └── {projectId}/
│       └── {sourceFileId}/
│           └── cleaned.parquet       ← after cleaning
└── harmonized/
    └── {projectId}/
        ├── patients.parquet          ← canonical outputs
        ├── encounters.parquet
        ├── care_assessments.parquet
        ├── lab_results.parquet
        └── manifest.json             ← lists available tables + row counts
```

---

## 3. System Architecture

```
User (Browser)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│              apps/web — Vite + React 19 SPA                  │
│  ├── Flow Canvas (ReactFlow 12)                              │
│  ├── Agent Panel (Zeit AI-style conversation UI)             │
│  ├── Dashboard (composed from pinned chat artifacts)         │
│  └── Settings (model config, project prefs)                  │
└──────────────┬───────────────────────────────────────────────┘
               │  REST + SSE (Vercel AI SDK data stream)
               ▼
┌─────────────────────────────────────────────────────────────┐
│              apps/api — Fastify 5 + TypeScript               │
│                                                              │
│  ┌─── Vercel AI SDK 6 (ToolLoopAgent) ───────────────────┐  │
│  │                                                        │  │
│  │  Pipeline Tools (node-triggered)                       │  │
│  │  ├─ parse_file          (auto, native TS)              │  │
│  │  ├─ profile_columns     (auto, native TS + LLM)        │  │
│  │  ├─ suggest_cleaning    (auto, LLM)                    │  │
│  │  ├─ execute_cleaning    (approval, E2B sandbox)        │  │
│  │  ├─ propose_mappings    (auto, LLM)                    │  │
│  │  ├─ confirm_mappings    (approval, Supabase metadata)  │  │
│  │  └─ run_harmonization   (approval, E2B sandbox)        │  │
│  │                                                        │  │
│  │  Analyst Tools (chat-triggered)                        │  │
│  │  ├─ run_query           (auto, E2B DuckDB/pandas)      │  │
│  │  ├─ generate_artifact   (auto, LLM → chart spec)       │  │
│  │  ├─ explain_lineage     (auto, Supabase metadata)      │  │
│  │  └─ run_script          (approval, E2B sandbox)        │  │
│  │                                                        │  │
│  │  Streaming: createUIMessageStream                      │  │
│  │  Events: onToolCallStart, onToolCallFinish,            │  │
│  │          onStepFinish                                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── Native Processing ─────────────────────────────────┐  │
│  │  PapaParse / xlsx   → file parsing                     │  │
│  │  TypeScript fns     → statistical profiling             │  │
│  │  Zod                → request validation                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── Data Layer (Supabase) ─────────────────────────────┐  │
│  │  Postgres: metadata only                               │  │
│  │  ├── Projects, settings                                │  │
│  │  ├── Source profiles, field mappings                    │  │
│  │  ├── Semantic layer (entities, fields, joins)          │  │
│  │  ├── Pipeline state (nodes, edges)                     │  │
│  │  ├── Conversations + messages                          │  │
│  │  ├── Pinned artifacts                                  │  │
│  │  └── Quality alerts                                    │  │
│  │                                                        │  │
│  │  Storage: all actual data files                         │  │
│  │  ├── raw/{projectId}/{sourceFileId}/original.csv       │  │
│  │  ├── cleaned/{projectId}/{sourceFileId}/cleaned.parquet│  │
│  │  └── harmonized/{projectId}/*.parquet                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── E2B Sandbox ───────────────────────────────────────┐  │
│  │  Python 3.13 + pandas + duckdb + numpy + scipy         │  │
│  │                                                        │  │
│  │  Used for:                                             │  │
│  │  ├── Cleaning (pandas transforms → Parquet)            │  │
│  │  ├── Harmonization (pandas joins/transforms → Parquet) │  │
│  │  ├── Querying (DuckDB SQL on Parquet → JSON)           │  │
│  │  └── Complex analytics (correlations, regressions)     │  │
│  │                                                        │  │
│  │  Receives: file URLs from Supabase Storage              │  │
│  │  Returns: JSON results + writes Parquet back to Storage │  │
│  │  Streams: stdout/stderr for real-time progress          │  │
│  │  Ephemeral: sandbox destroyed after each execution      │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. The Agent System

### 4.1 Single Contextual Agent

One AI agent per project, two behavioral modes determined by trigger:

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Pipeline** | Node action (upload, connect, run) | Data engineer — profiles, cleans, maps, transforms |
| **Conversation** | Chat input from user | Data analyst — queries Parquet store, generates artifacts, explains lineage |

### 4.2 Vercel AI SDK 6 Integration

The `ToolLoopAgent` manages the full execution loop:

- Multi-step tool execution (up to 20 steps per invocation)
- Tool approval gates (`needsApproval: true`)
- Real-time event streaming via `createUIMessageStream`
- Automatic retry and error recovery

### 4.3 Tool Definitions

#### Pipeline Tools

| Tool | Approval | Execution | Description |
|------|----------|-----------|-------------|
| `parse_file` | auto | Native TS | Parse CSV/Excel with PapaParse/xlsx. Returns column list, row count, sample rows, encoding. Uploads raw file to Supabase Storage. |
| `profile_columns` | auto | Native TS + LLM | **Phase 1 (Native):** Compute null rates, unique counts, min/max, type distribution per column. **Phase 2 (LLM):** Interpret stats → semantic labels, clinical domains, quality flags. |
| `suggest_cleaning` | auto | LLM | Given profiles, propose a cleaning plan: actions per column with reasoning. Returns structured plan for user review. |
| `execute_cleaning` | **approval** | E2B Sandbox | Spin up E2B → load raw file from Storage → apply cleaning plan with pandas → write cleaned Parquet to Storage → return before/after stats as JSON. |
| `propose_mappings` | auto | LLM | Given cleaned profiles + canonical schema, propose source→target column mappings with confidence, reasoning, transformation rules. |
| `confirm_mappings` | **approval** | Supabase | Write accepted mappings to `field_mappings` table. Auto-accept above threshold. |
| `run_harmonization` | **approval** | E2B Sandbox | Spin up E2B → load cleaned Parquets for all mapped sources → apply transforms, joins → write harmonized Parquets per target table to Storage → write manifest.json → update semantic layer → return summary as JSON. |

#### Analyst Tools

| Tool | Approval | Execution | Description |
|------|----------|-----------|-------------|
| `run_query` | auto | E2B Sandbox | Spin up E2B → load harmonized Parquets with DuckDB → execute SQL → return JSON results. Agent writes the SQL. |
| `generate_artifact` | auto | LLM | Given query results, generate a chart specification (type, axes, data). Emitted as a structured data part for the frontend to render. |
| `explain_lineage` | auto | Supabase | Trace target column back through `field_mappings` → `source_profiles` → `source_files`. Pure metadata query. |
| `run_script` | **approval** | E2B Sandbox | For complex analytics the user requests (correlations, regressions, custom pandas). Agent writes Python, user approves, runs in sandbox. |

#### Shared Tools

| Tool | Approval | Execution | Description |
|------|----------|-----------|-------------|
| `run_quality_check` | auto | E2B Sandbox | Load harmonized Parquets → compute null rates, range checks, duplicates → return quality report as JSON → write alerts to Supabase. |
| `update_semantic_layer` | auto | Supabase | Write/update `semantic_entities`, `semantic_fields`, `semantic_joins` after harmonization. |

### 4.4 Semantic Context Assembly

Before every agent invocation, the backend assembles the project's full knowledge into the system prompt:

1. Project metadata (name, description)
2. Source files (filename, row count, column count, processing status)
3. Source profiles (column → type, semantic label, domain, quality flags)
4. Field mappings (source → target, status, confidence, transformation)
5. Semantic entities (what harmonized Parquet files exist, their columns and types)
6. Semantic joins (how Parquet files relate to each other)
7. Pipeline state (which nodes exist, their status)
8. Recent quality alerts

This context enables the agent to write accurate DuckDB SQL or pandas code against the Parquet files without needing to inspect them first.

---

## 5. E2B Sandbox Details

### 5.1 Sandbox Lifecycle

Each tool execution that requires E2B follows this pattern:

```
1. Create E2B sandbox (Python 3.13, ~150ms cold start)
2. Install/verify packages (pandas, duckdb, numpy — pre-installed in template)
3. Download required files from Supabase Storage into sandbox filesystem
4. Execute Python script (AI-generated or from cleaning plan)
5. Stream stdout/stderr to frontend via onToolCallStart/onToolCallFinish
6. Upload output files (Parquet) back to Supabase Storage
7. Return JSON results to the agent
8. Destroy sandbox
```

### 5.2 DuckDB for Querying

When the chat agent needs to query harmonized data, it writes DuckDB SQL:

```python
import duckdb

conn = duckdb.connect()
result = conn.execute("""
    SELECT e.ward, AVG(ca.score) as avg_fall_risk, COUNT(*) as n
    FROM 'harmonized/care_assessments.parquet' ca
    JOIN 'harmonized/encounters.parquet' e
      ON ca.encounter_id = e.id
    WHERE ca.assessment_type = 'fall_risk'
    GROUP BY e.ward
    ORDER BY avg_fall_risk DESC
""").fetchdf()

print(result.to_json(orient='records'))
```

DuckDB reads Parquet files directly — no data loading, no database setup, instant columnar queries. The result comes back as JSON for the frontend to visualize.

### 5.3 Cleaning Execution

The agent converts the approved cleaning plan into a pandas script:

```python
import pandas as pd

df = pd.read_csv('/sandbox/raw/data.csv')

# From cleaning plan:
df['geburtsdatum'] = pd.to_datetime(df['geburtsdatum'], format='%d.%m.%Y')
df = df.dropna(subset=['patient_id'])
df['station'] = df['station'].str.strip().str.lower()
df['sturz_risiko'] = pd.to_numeric(df['sturz_risiko'], errors='coerce')

df.to_parquet('/sandbox/output/cleaned.parquet', index=False)
print(json.dumps({
    "rows": len(df),
    "columns": len(df.columns),
    "sample": df.head(5).to_dict(orient='records')
}))
```

### 5.4 Harmonization Execution

Harmonization loads multiple cleaned sources and joins/transforms them:

```python
import pandas as pd
import json

# Load cleaned sources
assessments = pd.read_parquet('/sandbox/cleaned/source_1/cleaned.parquet')
encounters = pd.read_parquet('/sandbox/cleaned/source_2/cleaned.parquet')

# Apply mappings (from confirmed field_mappings)
care_assessments = assessments.rename(columns={
    'sturz_risiko': 'score',
    'bewertungsdatum': 'assessed_at',
    'pruefer': 'assessor'
})
care_assessments['assessment_type'] = 'fall_risk'

# Write harmonized output
care_assessments.to_parquet('/sandbox/harmonized/care_assessments.parquet', index=False)
encounters_out.to_parquet('/sandbox/harmonized/encounters.parquet', index=False)

# Write manifest
manifest = {
    "tables": [
        {"name": "care_assessments", "rows": len(care_assessments), "columns": list(care_assessments.columns)},
        {"name": "encounters", "rows": len(encounters_out), "columns": list(encounters_out.columns)}
    ]
}
with open('/sandbox/harmonized/manifest.json', 'w') as f:
    json.dump(manifest, f)

print(json.dumps(manifest))
```

### 5.5 E2B Sandbox Template

CareMap should create a custom E2B sandbox template with pre-installed packages to eliminate install time:

```dockerfile
FROM e2b/code-interpreter:latest

RUN pip install pandas duckdb numpy scipy pyarrow
```

This ensures ~150ms cold starts with all packages ready.

---

## 6. Native Processing Layer

### 6.1 File Parsing (Native TypeScript)

| Format | Library | Notes |
|--------|---------|-------|
| CSV | PapaParse (installed) | Header detection, dynamic typing, streaming for large files |
| Excel (.xlsx) | `xlsx` or `exceljs` (to add) | Sheet selection, header row detection |

Parsing runs in the Fastify process. The parsed data is used for profiling, then the raw file is uploaded to Supabase Storage for later use by E2B.

### 6.2 Statistical Profiling (Native TypeScript)

Per-column statistics computed without the LLM:

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
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  topValues: Array<{ value: string; count: number }>;
  sampleValues: unknown[];
  patterns: string[];
}
```

Pure math — no hallucination risk. The LLM receives these statistics and interprets them semantically.

### 6.3 Cleaning Function Library

The LLM proposes a cleaning plan as a structured list of actions. These actions map to a fixed set of pandas operations — the LLM does not write arbitrary code for cleaning. The backend constructs the pandas script from the plan:

| Action | pandas Operation |
|--------|-----------------|
| `parseDate(column, format)` | `pd.to_datetime(df[col], format=fmt)` |
| `fillNulls(column, strategy)` | `df[col].fillna(df[col].mean())` / `.median()` / `.mode()[0]` / `df.dropna(subset=[col])` |
| `normalizeString(column, options)` | `df[col].str.strip().str.lower()` |
| `castType(column, type)` | `pd.to_numeric(df[col], errors='coerce')` |
| `deduplicateRows(columns)` | `df.drop_duplicates(subset=cols)` |
| `convertUnit(column, from, to, factor)` | `df[col] * factor` |

The backend generates a pandas script from the structured plan, which runs in E2B. This is safer than letting the LLM write arbitrary Python — the plan is auditable and the operations are constrained.

---

## 7. Pipeline Flows (Per Node Type)

### 7.1 Source Node: Upload → Profile → Clean

```
User uploads file to source node
    │
    ▼
┌─ parse_file (auto, native TS) ──────────────────────────┐
│  PapaParse/xlsx reads file in Fastify process             │
│  Upload raw file to Supabase Storage                      │
│  → Streams: "Parsing... 50,234 rows detected"             │
│  → Returns: columns, rowCount, sampleRows                 │
└───────────────────────────────────────────────────────────┘
    │
    ▼
┌─ profile_columns (auto, native TS + LLM) ────────────────┐
│  Phase 1 — Native TS: compute per-column stats             │
│  Phase 2 — LLM: interpret → semantic labels, domains       │
│  Save to: source_profiles table (metadata)                 │
│  → Streams: enriched column profiles one by one             │
└───────────────────────────────────────────────────────────┘
    │
    ▼
┌─ suggest_cleaning (auto, LLM) ───────────────────────────┐
│  Given: profiles with quality flags                        │
│  Returns: structured cleaning plan (action list)           │
│  → Streams: plan artifact for user review                  │
└───────────────────────────────────────────────────────────┘
    │
    ▼  ← USER APPROVAL GATE
┌─ execute_cleaning (approval, E2B sandbox) ────────────────┐
│  1. Spin up E2B sandbox                                    │
│  2. Download raw file from Supabase Storage                │
│  3. Generate pandas script from cleaning plan              │
│  4. Execute → cleaned DataFrame                            │
│  5. Write cleaned.parquet to Supabase Storage              │
│  6. → Streams: progress, before/after column stats          │
│  7. Update source_profiles with post-clean stats           │
│  8. Destroy sandbox                                        │
│                                                            │
│  Node status: raw → profiling → profiled → cleaning → clean│
└───────────────────────────────────────────────────────────┘
```

### 7.2 Mapping Node: Align Sources to Schema

```
User connects source nodes to mapping node
    │
    ▼
┌─ propose_mappings (auto, LLM) ───────────────────────────┐
│  Input: cleaned profiles from all connected sources        │
│  + canonical schema definition                             │
│  Returns: per-column mappings with confidence + reasoning   │
│  → Streams: mapping artifact (target-centric view)          │
└───────────────────────────────────────────────────────────┘
    │
    ▼  ← USER REVIEW (approve/reject/edit per mapping)
┌─ confirm_mappings (approval, Supabase metadata) ──────────┐
│  Write accepted mappings to field_mappings table            │
│  Auto-accept above threshold (default 0.85)                │
│  → Streams: confirmation summary                            │
│                                                            │
│  Node status: idle → proposing → proposed → confirmed       │
└───────────────────────────────────────────────────────────┘
```

### 7.3 Output Node: Harmonize to Parquet Store

```
User triggers harmonization on output node
    │
    ▼  ← USER APPROVAL GATE
┌─ run_harmonization (approval, E2B sandbox) ───────────────┐
│  1. Spin up E2B sandbox                                    │
│  2. Download cleaned Parquets for all mapped sources       │
│  3. Generate pandas script from confirmed mappings:         │
│     - Column renames, type casts, expression transforms     │
│     - Joins across sources where keys match                 │
│  4. Execute → harmonized DataFrames per target table        │
│  5. Write Parquets to Supabase Storage:                     │
│     harmonized/{projectId}/patients.parquet                 │
│     harmonized/{projectId}/encounters.parquet               │
│     harmonized/{projectId}/care_assessments.parquet         │
│  6. Write manifest.json (table names, row counts, columns)  │
│  7. → Streams: progress per table, row counts               │
│  8. Destroy sandbox                                        │
│                                                            │
│  Node status: idle → harmonizing → complete                 │
└───────────────────────────────────────────────────────────┘
    │
    ▼
┌─ update_semantic_layer (auto, Supabase) ──────────────────┐
│  From manifest.json, write to:                             │
│  - semantic_entities (one per Parquet file)                 │
│  - semantic_fields (columns in each Parquet)               │
│  - semantic_joins (detected relationships)                  │
│                                                            │
│  This is what the chat agent reads for query context.       │
└───────────────────────────────────────────────────────────┘
```

---

## 8. Chat Agent: Querying the Parquet Store

### 8.1 How It Works

When the user asks a question in the project chat:

1. Agent receives the message + full semantic context (§4.4)
2. Determines which Parquet files and joins are needed
3. Writes DuckDB SQL or pandas code
4. Calls `run_query` tool → E2B sandbox loads Parquets → executes → returns JSON
5. Agent interprets results in plain language
6. Optionally generates a chart artifact via `generate_artifact`

Example questions and how they resolve:

| Question | Agent Action |
|----------|-------------|
| "How many patients had a fall risk > 3 in Q2 2024?" | DuckDB SQL on care_assessments.parquet + encounters.parquet |
| "Show me the distribution of lab results by test type" | DuckDB SQL + `generate_artifact` (bar chart) |
| "Which source contributed the most nulls?" | Metadata query on source_profiles (Supabase, no sandbox) |
| "What's the correlation between fall risk and length of stay?" | pandas script with `.corr()` in E2B |

### 8.2 Query Safety

- E2B sandbox is fully isolated — no access to Supabase credentials or backend infra
- Sandbox receives signed URLs to Parquet files (read-only, time-limited)
- Sandbox cannot modify Storage files — it can only read
- Results are capped at configurable row limit (default 1000)
- Sandbox has execution timeout (default 30s)

### 8.3 Artifact Generation

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

The frontend renders this inline using shadcn/Recharts. The user can **pin** the artifact to the dashboard.

---

## 9. Streaming & UX Patterns

### 9.1 Stream Protocol

All agent interactions use the Vercel AI SDK **data stream protocol** over SSE.

| Event Type | Description | Frontend Rendering |
|------------|-------------|-------------------|
| `text-delta` | Incremental text from the agent | Appended to message body |
| `tool-call` | Agent is invoking a tool (name + args) | Collapsible "ToolStep" component |
| `tool-result` | Tool execution completed | Updates ToolStep with results |
| `data` | Structured data part (artifact, progress) | Inline component (chart, table) |
| `error` | Error during processing | Error banner |
| `finish` | Agent turn complete | Enables user input |

### 9.2 Tool Approval UX

When the agent calls a tool with `needsApproval: true`:

1. Tool call streamed to frontend with arguments
2. Frontend renders an approval block (what will happen + Approve / Reject)
3. User's decision sent back via `POST /api/conversations/:id/approve`
4. On approval: tool executes in E2B, results stream back
5. On rejection: agent acknowledges, asks for guidance

### 9.3 Progress Streaming from E2B

E2B sandbox streams stdout/stderr in real-time. The backend forwards these as transient data parts:

```json
{ "type": "progress", "id": "clean-progress", "message": "Cleaning column 8/23: geburtsdatum..." }
{ "type": "progress", "id": "harmonize-progress", "current": 2500, "total": 50234, "table": "care_assessments" }
```

Transient parts render as live progress indicators and don't persist in conversation history.

---

## 10. Project Settings & Dashboard

### 10.1 Project Settings

Stored in `projects.settings` (JSONB):

```json
{
  "autoAcceptThreshold": 0.85,
  "defaultModel": "gpt-4.1",
  "dashboardRefreshInterval": 300,
  "pinnedArtifactIds": ["artifact-1", "artifact-2"],
  "cleaningDefaults": { "nullStrategy": "drop", "dateFormat": "ISO" }
}
```

### 10.2 Dashboard as Pinned Artifacts

The dashboard is composed from conversation artifacts:

1. User asks question in chat → agent queries data → generates chart
2. User clicks "Pin to Dashboard" on the artifact
3. Backend stores the artifact spec + the DuckDB SQL / pandas code in `pinned_widgets`
4. Dashboard page renders all pinned widgets
5. Widgets can auto-refresh by re-executing their query in a new E2B sandbox

---

## 11. Database Schema (Metadata Only)

Supabase Postgres stores **metadata only**. No clinical data rows.

### Tables to keep from `001_initial_schema.sql`:

```
projects                    → project metadata + settings
source_files                → file references (points to Storage)
source_profiles             → column-level profiling metadata
field_mappings              → mapping decisions
pipeline_nodes              → canvas node state
pipeline_edges              → canvas edge state
semantic_entities           → what harmonized tables exist
semantic_fields             → columns in each entity
semantic_joins              → relationships between entities
pinned_widgets              → dashboard artifacts
quality_alerts              → data quality issues
```

### Tables to REMOVE from `001_initial_schema.sql`:

All canonical clinical tables are replaced by Parquet files in Storage:

```
patients                    → REMOVE (now harmonized/patients.parquet)
encounters                  → REMOVE (now harmonized/encounters.parquet)
diagnoses                   → REMOVE
lab_results                 → REMOVE
vital_signs                 → REMOVE
medications                 → REMOVE
care_assessments            → REMOVE
care_interventions          → REMOVE
sensor_readings             → REMOVE
staff_schedules             → REMOVE
```

### New tables (to add in `002_conversations.sql`):

```sql
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

alter table projects add column settings jsonb not null default '{}';
```

---

## 12. Dependency Changes

### Add

| Package | Purpose |
|---------|---------|
| `ai` (Vercel AI SDK 6) | ToolLoopAgent, createUIMessageStream, tool definitions |
| `@e2b/code-interpreter` | Sandboxed Python execution (cleaning, harmonization, querying) |
| `xlsx` or `exceljs` | Excel file parsing |

### Keep

| Package | Purpose |
|---------|---------|
| `fastify`, `@fastify/cors`, `@fastify/multipart` | HTTP server, CORS, file uploads |
| `@supabase/supabase-js` | Metadata database + file storage client |
| `papaparse` | CSV parsing (native TS) |
| `zod` | Request validation |
| `dotenv`, `tsx`, `typescript` | Dev tooling |

### Remove

| Package | Reason |
|---------|--------|
| `openai` | Replaced by Vercel AI SDK |

### Environment Variables

```env
# E2B
E2B_API_KEY=e2b_...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# LLM (via Vercel AI SDK)
OPENAI_API_KEY=sk-...
# or ANTHROPIC_API_KEY=sk-ant-...

LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1

CORS_ORIGIN=http://localhost:5173
```

---

## 13. Migration from Current Scaffold

### Phase 1: Native Profiling (no E2B needed yet)

| File | Change |
|------|--------|
| `services/profiler.ts` | Add `computeColumnStats()` (pure TS). Keep LLM interpretation but feed it computed stats. |
| `services/storage.ts` | **New.** Wrapper around Supabase Storage: upload, download, signed URLs, path helpers. |

### Phase 2: E2B Sandbox Integration

| File | Change |
|------|--------|
| `services/sandbox.ts` | **New.** E2B wrapper: create sandbox, upload files, execute Python, stream output, download results. |
| `services/cleaner.ts` | **New.** Converts cleaning plan into pandas script, runs in E2B, uploads Parquet to Storage. |

### Phase 3: Harmonization via E2B

| File | Change |
|------|--------|
| `services/harmonizer.ts` | Rewrite: generate pandas script from mappings, execute in E2B, upload Parquets, write manifest. |
| `services/semantic.ts` | **New.** Parse manifest.json → update `semantic_entities`, `semantic_fields`, `semantic_joins`. |

### Phase 4: Vercel AI SDK Agent

| File | Change |
|------|--------|
| `config/ai.ts` | Replace `openai` with Vercel AI SDK provider setup. |
| `services/agent.ts` | Rewrite: define tools as AI SDK `tool()` objects, wire into `ToolLoopAgent`. |
| `routes/chat.ts` | Simplify: pipe agent stream to response. |

### Phase 5: Chat Querying via DuckDB

| File | Change |
|------|--------|
| `services/query.ts` | **New.** Generate DuckDB SQL from semantic context, execute in E2B, return JSON. |
| Agent tool definition | Add `run_query` tool that uses `query.ts`. |

### Phase 6: Conversations + Artifacts

| File | Change |
|------|--------|
| `supabase/migrations/002_conversations.sql` | **New.** Conversations, messages, project settings. |
| `services/conversation.ts` | **New.** CRUD, context window trimming. |

---

## 14. API Routes

### Existing (keep, evolve)

| Route | Evolves To |
|-------|-----------|
| `POST /api/ingest` | ToolLoopAgent-driven: parse + profile + suggest cleaning |
| `POST /api/chat` | ToolLoopAgent with DuckDB/pandas tools |
| `GET /api/mappings` | No change (metadata query) |
| `POST /api/mappings/generate` | ToolLoopAgent tool |
| `POST /api/harmonize` | E2B sandbox execution → Parquet output |
| `GET /api/dashboard` | Pinned artifact rendering |
| `CRUD /api/projects` | Add `settings` field |

### New

| Route | Purpose |
|-------|---------|
| `POST /api/projects/:id/pipeline/trigger` | Trigger agent for node action. Returns SSE stream. |
| `GET /api/projects/:id/conversations` | List conversations |
| `POST /api/conversations/:id/approve` | Approve/reject pending tool call |
| `GET /api/projects/:id/semantic` | Get semantic layer |
| `POST /api/projects/:id/artifacts/:id/pin` | Pin artifact to dashboard |

---

## 15. Security

| Concern | Mitigation |
|---------|-----------|
| E2B sandbox escape | Firecracker microVMs, hardware isolation. Sandbox receives signed URLs, not credentials. |
| LLM writes bad cleaning code | Cleaning plan uses a **fixed action library** mapped to known pandas operations. The LLM picks actions + params, not arbitrary code. |
| Data access in sandbox | Signed URLs are read-only and time-limited. Sandbox cannot write to Storage paths it doesn't own. |
| HIPAA / clinical data | E2B is SOC 2 Type II. Supabase is SOC 2 Type II. For production: self-hosted sandbox, encrypted storage. |
| Tool approval bypass | `needsApproval` enforced server-side by AI SDK. |

---

## 16. Performance Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| File parse (CSV, < 50MB) | < 2s | Native PapaParse |
| Statistical profiling | < 3s for 50k rows | Native TS, single pass |
| LLM interpretation | < 5s | Single structured completion |
| E2B sandbox cold start | ~150ms | Custom template with pre-installed packages |
| Cleaning (50k rows in E2B) | < 8s | pandas, single script execution |
| Harmonization (50k rows, 5 tables) | < 15s | pandas transforms + Parquet write |
| DuckDB query on Parquet | < 3s | Columnar engine, no data loading overhead |
| Chart artifact generation | < 3s | Single LLM call |

---

## 17. Reference Implementations

| Product / Paper | Key Takeaway |
|----------------|--------------|
| **aha (IGC Pharma)** | 4-step loop: Profile → Plan → Execute → Validate. CareMap follows the same loop. |
| **CleanAgent (VLDB 2025)** | LLM generates code from a fixed API library — same as CareMap's cleaning action library. |
| **OMOP CDM Agentic Architecture (Jan 2026)** | "Data engineers become validators, not coders" — CareMap's thesis. |
| **Amazon SageMaker Data Agent** | Agent writes SQL/Python, executes in managed sandbox, returns results. Same pattern as CareMap's E2B + DuckDB. |
| **Vercel AI SDK 6 ToolLoopAgent** | Built-in approval, streaming, multi-step loops. |
| **E2B Code Interpreter** | 150ms cold start, pandas/duckdb pre-installed, streaming stdout. |
| **DuckDB** | In-process analytical SQL engine, reads Parquet directly, no database setup. |
