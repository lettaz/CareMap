# CareMap — Technical Requirements & User Flows

**Version:** 1.0 · March 2026

---

# Part A: Technical Requirements Document

---

## 1. System Architecture

CareMap is structured as a monorepo with two workspaces: `apps/web` (Vite + React SPA frontend) and `apps/api` (Fastify backend). The backend follows a **native-first execution model** — all data operations run as native TypeScript or Supabase SQL before considering external sandboxes. Full architectural details are in `docs/06-backend-architecture.md`.

### Architecture Diagram

```
User (Browser)
    │
    ▼
┌───────────────────────────────────────────────────────┐
│            apps/web — Vite + React 19 SPA              │
│                                                        │
│  FRONTEND                                              │
│  ├── Flow Canvas (ReactFlow 12)                       │
│  ├── Agent Panel (Zeit AI-style conversation UI)      │
│  │   └── CareMap AI (single contextual agent)         │
│  ├── Dashboard (composed from pinned chat artifacts)  │
│  └── Settings (model config, project prefs)           │
│                                                        │
│  STATE MANAGEMENT (Zustand, project-scoped)           │
│  ├── pipeline-store  → nodes, edges, selection        │
│  ├── agent-store     → chat sessions per project      │
│  ├── dashboard-store → widgets, alerts                │
│  └── project-store   → project list, metadata         │
│                                                        │
│  ROUTING (React Router 7)                             │
│  ├── /                       → Project listing        │
│  ├── /projects/:id/canvas    → Pipeline builder       │
│  ├── /projects/:id/dashboard → Analytics dashboard    │
│  └── /settings               → Configuration         │
└────────────┬──────────────────────────────────────────┘
             │  REST + SSE (Vercel AI SDK data stream)
             ▼
┌───────────────────────────────────────────────────────┐
│            apps/api — Fastify 5 + TypeScript           │
│                                                        │
│  AGENT LAYER (Vercel AI SDK 6)                         │
│  ├── ToolLoopAgent (single contextual agent)           │
│  │   ├── Pipeline tools (parse, profile, clean, map)   │
│  │   ├── Analyst tools (query, artifact, lineage)      │
│  │   └── Shared tools (quality, semantic layer)        │
│  ├── Streaming: createUIMessageStream                  │
│  └── Approval gates: needsApproval per tool            │
│                                                        │
│  NATIVE PROCESSING LAYER                               │
│  ├── PapaParse / xlsx → file parsing                   │
│  ├── TypeScript fns   → stats, cleaning, transforms    │
│  └── Zod              → schema validation              │
│                                                        │
│  API ROUTES                                            │
│  ├── POST /api/ingest       → File parse + profiling   │
│  ├── POST /api/chat         → Agent streaming (tools)  │
│  ├── POST /api/pipeline/run → Node-triggered agent     │
│  ├── GET  /api/mappings     → Mapping CRUD             │
│  ├── POST /api/harmonize    → Write to canonical store │
│  ├── GET  /api/dashboard    → Pinned artifacts + alerts│
│  └── CRUD /api/projects     → Project management       │
└────────────┬──────────────────────────────────────────┘
             │
     ┌───────┼────────┐
     ▼       ▼        ▼
┌─────────┐ ┌──────┐ ┌───────────────┐
│Supabase │ │ LLM  │ │ E2B Sandbox   │
│(Postgres│ │      │ │ (escape hatch │
│+Storage │ │GPT/  │ │  for complex  │
│+Realtime│ │Claude│ │  analytics)   │
│)        │ │/Local│ │               │
└─────────┘ └──────┘ └───────────────┘
```

### Key Architectural Decision: Native-First Execution

Data operations follow a priority chain:

1. **Native TypeScript** — file parsing, statistical profiling (null rates, distributions, type detection), cleaning (date parsing, null handling, dedup), row transformation. No LLM, no sandbox.
2. **Supabase SQL** — querying the harmonized store, aggregations, quality checks, joins, referential integrity. Uses `execute_readonly_sql` RPC for safe read-only queries.
3. **LLM Inference** — semantic interpretation (clinical labels, domain mapping), mapping proposals with reasoning, cleaning plan suggestions, chat responses. The LLM reasons about data; it does not process it directly.
4. **E2B Sandbox** — the primary execution environment for all data manipulation: cleaning (pandas), harmonization (pandas → Parquet), querying (DuckDB on Parquet → JSON), and complex analytics.

### Key Architectural Decision: Metadata vs Data Separation

Supabase Postgres stores **metadata only** — projects, profiles, mappings, pipeline state, conversations, semantic layer. Never the actual data rows. All data files (raw uploads, cleaned outputs, harmonized Parquets) live in **Supabase Storage**. Analytical queries run in **E2B sandboxes** using DuckDB against Parquet files, returning JSON results. No canonical clinical tables in Postgres.

### Key Architectural Decision: Single Contextual AI Agent

CareMap uses a **single unified AI agent** ("CareMap AI") powered by Vercel AI SDK 6's `ToolLoopAgent`. The agent adapts its behavior based on trigger context:

- **Pipeline mode** (triggered by node actions): acts as a data engineer — profiles, cleans, maps, transforms
- **Conversation mode** (triggered by chat input): acts as a data analyst — queries Parquet store via DuckDB, generates artifacts, explains lineage

Same agent, same tools, same semantic context. The system prompt adapts a preamble based on the trigger type.

The conversation UI follows a **document-stream pattern** inspired by Zeit AI:
- User messages with inline entity references (data assets as interactive pills)
- Agent responses with transparent tool execution steps, rich content, tabbed artifacts (tables, charts), and approval gates
- Full provenance and reasoning for every AI action

Agent tools: `parse_file`, `profile_columns`, `suggest_cleaning`, `execute_cleaning`, `propose_mappings`, `confirm_mappings`, `run_harmonization`, `run_query`, `generate_artifact`, `explain_lineage`, `run_quality_check`, `update_semantic_layer`, `run_script`. All tools share a semantic layer stored in Supabase.

### Key Architectural Decision: Dynamic Semantic Layer

The semantic layer is generated dynamically from user uploads and confirmed mappings. It is stored in Supabase (`semantic_entities`, `semantic_fields`, `semantic_joins`) and assembled into the agent's system prompt before every invocation.

**Write path:** Source upload → native profiling → LLM interpretation → profiles saved → user confirms mappings → harmonization runs in E2B (pandas → Parquet) → Parquets uploaded to Supabase Storage → `update_semantic_layer` reads manifest.json and writes entities, fields, joins.

**Read path:** User asks a question in chat → backend assembles semantic context from Supabase metadata → agent writes DuckDB SQL or pandas code → `run_query` spins up E2B sandbox → loads Parquets → executes → returns JSON → agent formats response + optional chart artifact.

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend Build | Vite | 6.x | Fast dev server and production bundler |
| UI Framework | React | 19.x | Component-based UI |
| Language | TypeScript | 5.x | Type safety across frontend and backend |
| Routing | React Router | 7.x | Client-side routing |
| State Management | Zustand | — | Lightweight project-scoped stores |
| Canvas | ReactFlow | 12.x | Node-based visual pipeline editor |
| Charts | Recharts | 2.x | Chart rendering in chat and dashboard |
| Styling | Tailwind CSS | 4.x | Utility-first CSS with custom design tokens |
| Components | shadcn/ui (@base-ui/react) | — | Headless component primitives (uses `render` prop, NOT `asChild`) |
| Icons | Lucide React | — | Consistent icon system |
| Fonts | Inter + Geist Mono | — | Body and monospace typography |
| Backend | Fastify | 5.x | REST API server (apps/api workspace) |
| AI Agent | Vercel AI SDK | 6.x | ToolLoopAgent, tool approval, streaming |
| Database | Supabase (Postgres + Storage) | — | Metadata store (profiles, mappings, pipeline state) + file storage (raw, cleaned, harmonized Parquets) |
| File Parsing | PapaParse | 5.x | CSV parsing (native TS) |
| File Parsing | xlsx / exceljs | — | Excel parsing (native TS) |
| Validation | Zod | 3.x | Request/schema validation |
| Sandbox | E2B Code Interpreter | — | Python sandbox for cleaning, harmonization, querying (pandas + DuckDB) |
| Analytical Engine | DuckDB (in E2B) | — | SQL queries on Parquet files, no separate database needed |
| Data Format | Apache Parquet | — | Columnar format for harmonized data in Supabase Storage |
| Frontend Hosting | Vercel | — | Connected to GitHub repo |
| Backend Hosting | Railway / Vercel | — | Fastify API deployment |

---

## 3. Database Schema

Supabase Postgres stores **metadata only**. All clinical data lives as Parquet files in Supabase Storage. See `docs/06-backend-architecture.md` §2 for the full data lifecycle and storage bucket structure.

### Canonical Clinical Data (Parquet in Supabase Storage)

Clinical data is NOT stored in Postgres tables. After harmonization, data is written as Parquet files:

```
Supabase Storage: caremap-files/harmonized/{projectId}/
  ├── patients.parquet
  ├── encounters.parquet
  ├── diagnoses.parquet
  ├── lab_results.parquet
  ├── vital_signs.parquet
  ├── medications.parquet
  ├── care_assessments.parquet
  ├── care_interventions.parquet
  ├── sensor_readings.parquet
  ├── staff_schedules.parquet
  └── manifest.json          ← lists tables, row counts, columns
```

These files are queried via DuckDB in E2B sandboxes. The schema is flexible — each project's harmonization may produce different tables based on its source data.

### Semantic Layer Metadata Tables

```
source_profiles
  id              UUID, PK
  source_file_id  UUID → source_files
  column_name     TEXT
  inferred_type   TEXT (string, number, date, code)
  semantic_label  TEXT (e.g., "Fall Risk Score")
  domain          TEXT (e.g., "care_assessments")
  confidence      NUMERIC (0-1)
  sample_values   JSONB
  quality_flags   JSONB
  user_corrected  BOOLEAN

semantic_entities
  id              UUID, PK
  entity_name     TEXT (e.g., "care_assessments")
  description     TEXT
  parquet_path    TEXT (e.g., "harmonized/{projectId}/care_assessments.parquet")
  row_count       INT
  created_from    JSONB (list of source_file_ids that contributed)
  updated_at      TIMESTAMPTZ

semantic_fields
  id              UUID, PK
  entity_id       UUID → semantic_entities
  field_name      TEXT
  data_type       TEXT
  description     TEXT

semantic_joins
  id              UUID, PK
  from_entity_id  UUID → semantic_entities
  to_entity_id    UUID → semantic_entities
  join_column     TEXT (e.g., "encounter_id")
```

### Pipeline State Tables

```
source_files
  id              UUID, PK
  filename        TEXT
  file_type       TEXT (csv, xlsx, pdf, txt)
  uploaded_at     TIMESTAMPTZ
  row_count       INT
  raw_profile     JSONB (full AI profiling result)

field_mappings
  id              UUID, PK
  source_file_id  UUID → source_files
  source_column   TEXT
  target_table    TEXT
  target_column   TEXT
  transformation  TEXT
  confidence      NUMERIC
  status          TEXT (pending, accepted, rejected)
  reviewed_by     TEXT
  reviewed_at     TIMESTAMPTZ

pipeline_nodes
  id              UUID, PK
  node_type       TEXT
  label           TEXT
  config          JSONB
  position        JSONB ({x, y})
  status          TEXT (idle, profiling, ready, error)

pipeline_edges
  id              UUID, PK
  source_node_id  UUID → pipeline_nodes
  target_node_id  UUID → pipeline_nodes

pinned_widgets
  id              UUID, PK
  title           TEXT
  query_text      TEXT (the NL question that generated it)
  sql_query       TEXT (the SQL that was executed)
  chart_spec      JSONB (Recharts-compatible spec)
  pinned_at       TIMESTAMPTZ

quality_alerts
  id              UUID, PK
  severity        TEXT (critical, warning, info)
  summary         TEXT
  source_file_id  UUID → source_files
  affected_count  INT
  detection_method TEXT
  acknowledged    BOOLEAN
  created_at      TIMESTAMPTZ
```

---

## 4. API Contracts

Full route details in `docs/06-backend-architecture.md` §12. Summary below.

### POST /api/ingest

Triggered when a file is uploaded to a source node. Runs the agent in pipeline mode: parse → profile → suggest cleaning → (approval) → clean.

```
Request:
  Content-Type: multipart/form-data
  Query: projectId, nodeId
  Fields: file (File)

Response:
  Content-Type: text/event-stream (Vercel AI SDK data stream)
  Stream contents (via createUIMessageStream):
    - text-delta: agent narration ("Parsing 50,234 rows...")
    - tool-call: parse_file → tool-result: { columns, rowCount }
    - tool-call: profile_columns → tool-result: per-column stats + semantic labels
    - tool-call: suggest_cleaning → tool-result: cleaning plan artifact
    - tool-call: execute_cleaning (needsApproval) → pauses for user
    - On approval: tool-result: cleaned stats, before/after samples
```

### POST /api/chat

Conversational queries via the agent in conversation mode.

```
Request:
  { messages: Message[], projectId: string }

Response:
  Content-Type: text/event-stream (Vercel AI SDK data stream)
  Stream contents:
    - text-delta: narrative explanation
    - tool-call: run_query → tool-result: SQL results
    - tool-call: generate_artifact → data part: chart spec
    - tool-call: explain_lineage → tool-result: provenance chain
    - tool-call: run_analysis_script (needsApproval) → pauses for approval
```

### POST /api/projects/:id/pipeline/trigger

Triggers agent for a specific node action (connect sources to mapping node, run harmonization).

```
Request:
  { nodeId: string, action: "map" | "harmonize" }

Response:
  Content-Type: text/event-stream (Vercel AI SDK data stream)
  Stream contents vary by action (mapping proposals, harmonization progress)
```

### POST /api/conversations/:id/approve

Sends approval or rejection for a pending tool call.

```
Request:
  { toolCallId: string, approved: boolean, feedback?: string }

Response:
  { acknowledged: true }
  (agent resumes on the existing SSE stream)
```

### GET /api/dashboard

Fetches current dashboard state (pinned artifacts + quality alerts).

```
Response:
  {
    widgets: PinnedWidget[],
    alerts: QualityAlert[],
    sources: { id, filename, rowCount, mappedFields, unmappedFields }[]
  }
```

### Additional Routes

| Route | Purpose |
|-------|---------|
| `CRUD /api/projects` | Project management + settings |
| `GET /api/mappings?projectId=` | Fetch mappings for a project |
| `PATCH /api/mappings/:id` | Update a single mapping |
| `POST /api/mappings/bulk-accept` | Auto-accept above threshold |
| `GET /api/projects/:id/semantic` | Get semantic layer |
| `GET /api/projects/:id/conversations` | List conversations |
| `POST /api/projects/:id/artifacts/:id/pin` | Pin artifact to dashboard |

---

## 5. Agent Tool Specifications

CareMap uses a single unified agent (Vercel AI SDK 6 `ToolLoopAgent`) with access to all tools. The agent adapts its tool usage based on trigger context. Full details in `docs/06-backend-architecture.md` §3.3.

### Pipeline Tools (node-triggered)

| Tool | Approval | Execution Tier | Description |
|------|----------|---------------|-------------|
| `parse_file` | auto | Native TS | Parse CSV/Excel. Returns columns, row count, sample rows, encoding. |
| `profile_columns` | auto | Native TS + LLM | **Phase 1:** Native TS computes stats (nulls, uniques, distributions). **Phase 2:** LLM interprets stats semantically (labels, domains, flags). |
| `suggest_cleaning` | auto | LLM | Propose cleaning plan using a **fixed function library** (parseDate, fillNulls, normalizeString, etc). Returns structured plan, not arbitrary code. |
| `execute_cleaning` | **approval** | Native TS | Apply approved cleaning plan using deterministic TS functions. |
| `propose_mappings` | auto | LLM | Map source columns to canonical schema with confidence and reasoning. |
| `confirm_mappings` | **approval** | Native TS | Write accepted mappings to DB. Auto-accept above threshold. |
| `run_harmonization` | **approval** | Native TS + SQL | Transform rows per mappings, batch insert into canonical tables. |

### Analyst Tools (chat-triggered)

| Tool | Approval | Execution Tier | Description |
|------|----------|---------------|-------------|
| `run_query` | auto | Supabase SQL | Read-only SQL against harmonized store, project-scoped. |
| `generate_artifact` | auto | LLM | Generate chart spec from query results. Emitted as structured data part. |
| `explain_lineage` | auto | Supabase SQL | Trace target column → mapping → source file provenance chain. |
| `run_analysis_script` | **approval** | E2B Sandbox | Complex analytics (correlations, regressions) in isolated Python. Escape hatch only. |

### Shared Tools

| Tool | Approval | Execution Tier | Description |
|------|----------|---------------|-------------|
| `run_quality_check` | auto | Native TS + SQL | Post-harmonization validation: nulls, ranges, referential integrity. |
| `update_semantic_layer` | auto | Supabase | Write/update semantic entities, fields, joins after harmonization. |

---

## 6. Semantic Context Assembly

When the agent is invoked, the backend assembles the project's full knowledge into the system prompt:

1. **Project metadata** — name, description, creation date
2. **Source files** — filename, row count, column count, processing status
3. **Source profiles** — column → type, semantic label, domain, quality flags, sample values
4. **Field mappings** — source → target, status, confidence, transformation
5. **Semantic entities** — canonical tables available for querying, with descriptions
6. **Semantic joins** — how canonical tables relate to each other
7. **Pipeline state** — which nodes exist, their type and status
8. **Quality alerts** — recent unacknowledged issues

This context enables the chat agent to translate natural language into accurate SQL without a separate retrieval or sandbox hydration step. The semantic layer is injected directly into the context window.

---

## 7. Deployment

### Hackathon

- Frontend: Vercel (connected to `lettaz/CareMap` GitHub repo, auto-deploys on push to `main`)
  - Root Directory: `apps/web`
  - Framework: Vite
  - Build: `tsc -b && vite build`
- Backend: `apps/api` (Fastify, to be deployed separately — Railway or Vercel)
- Database: Supabase free tier (hosted Postgres)
- LLM: Cloud provider (GPT-4.1 / Claude Sonnet)

### Production Path (Presentation Only)

- Frontend + API: Docker container in hospital data centre
- Database: PostgreSQL on hospital server
- LLM: Ollama running Llama/Mistral locally (same API shape as OpenAI)
- Network: Air-gapped, no external calls

---

# Part B: User Flows, Journeys, and Stories

---

## 8. User Journey Map

### Petra (Data Steward) — End-to-End Journey

```
DISCOVER          ONBOARD            CORE TASK                    SUCCESS            RETENTION
─────────────────────────────────────────────────────────────────────────────────────────────
"We need to       Opens CareMap,     Uses visual canvas + AI:     Data harmonized,   Returns weekly
harmonize our     sees empty         1. Adds source nodes         quality dashboard   to add new
fall risk and     canvas with        2. Uploads files             shows 95%          sources and
lab data for      helpful prompt.    3. AI auto-profiles data     completeness.      review quality.
analytics."       Chat panel shows   4. Reviews rich preview      Opens chat, asks:  Anomaly alerts
                  CareMap AI with    5. Connects to mapper        "avg fall risk     prompt her to
                  suggestion         6. Reviews per-field         by ward?"          investigate
                  buttons.              mapping table             Gets instant       in chat.
                                     7. Corrects 3 uncertain     chart with full
                                        mappings                  provenance and
                                     8. Harmonizes               transparent tool
                                     9. Verifies in dashboard    steps.

Emotion:          Emotion:           Emotion:                     Emotion:           Emotion:
Skeptical but     Pleasantly         Impressed — the AI shows     Satisfied —        Trusts the AI.
hopeful.          surprised by       every step transparently.    this used to       Uses it
                  the clean UI       She corrected it, and it    take weeks.        routinely.
                  and suggestions.   worked.
```

### Daniel (Clinical Analyst) — Query Journey

```
TRIGGER           EXPLORE            ANALYSE                      ACT                SHARE
─────────────────────────────────────────────────────────────────────────────────────────────
Receives alert:   Opens dashboard,   Opens chat panel, asks:      AI traces          Pins the chart
"Fall risk data   sees anomaly       "Show fall risk trends       lineage: source    to dashboard.
completeness      in the feed.       by ward, last 90 days,       file → column →    The fix is
dropped below     Clicks to see      highlight wards below 80%."  mapping rule.      tracked in the
80% for Ward B."  affected records.                               Discovers: source  conversation
                                     AI shows tool steps:         format changed.    history.
                                     profiling → querying →       Asks: "Fix the
                                     charting. Returns chart      mapping for
                                     + data table in artifact     Ward B creatinine
                                     tabs. Daniel sees exactly    values?"
                                     what was queried.            AI proposes fix
                                                                  with approval.

Emotion:          Emotion:           Emotion:                     Emotion:           Emotion:
Concerned.        Relieved —         Impressed — tool steps       Root cause         Confident the
                  easy to find.      show full transparency.      found fast.        issue is tracked.
```

---

## 9. Core User Flows

### Flow 1: First-Time Source Upload and Profiling

```
Start
  │
  ▼
Canvas is empty → empty state prompts "Add a data source"
  │
  ▼
User clicks "+" → Node palette opens
  │
  ▼
User drags "CSV Source" onto canvas → Node appears with grey status
  │
  ▼
Node is auto-selected → Inspector opens to Upload tab
  │
  ▼
User drops care_assessments.csv into upload zone
  │
  ▼
Loading indicator on node → file parses (< 1 second)
  │
  ▼
Node subtitle updates: "247 rows · 12 fields"
  │
  ▼
Inspector auto-switches to Profile tab
  │
  ▼
AI profiling streams in: columns appear one by one
  ├── Sturzrisiko_Skala → Fall Risk Score [92%] ✓
  ├── Mobilität → Mobility Score [87%] ✓
  ├── PatientNr → Patient ID [95%] ✓
  ├── UnknownCol → ??? [34%] ⚠ (needs review)
  └── ... (remaining columns)
  │
  ▼
User clicks UnknownCol → dropdown appears → selects "Assessment Date"
  │
  ▼
Node status dot turns green → label shows "Care Assessments"
  │
  Done
```

**Edge cases:**
- File is too large (>10MB): Show warning, suggest sampling.
- File has no headers: AI attempts to infer from first row; flag for user confirmation.
- File is empty: Show error state on node, "File contains no data."
- PDF extraction fails: Show partial results with "Some content could not be extracted" warning.

### Flow 2: Mapping Review and Harmonization

```
Start (source node is profiled and green)
  │
  ▼
User drags "Mapping" node onto canvas
  │
  ▼
User draws edge from CSV Source → Mapping node
  │
  ▼
AI auto-generates mapping suggestions in the background
  │
  ▼
User clicks Mapping node → right panel switches to Mapping Detail Panel
  │
  ▼
Mapping table shows per-field suggestions:
  ├── Sturzrisiko_Skala → care_assessments.score [92%] ✓
  ├── Mobilität → care_assessments.score (mobility) [87%] ✓
  ├── PatientNr → patients.external_id [95%] ✓
  ├── Datum → care_assessments.assessed_at [90%] ✓
  └── Station → encounters.ward [78%] ⚠ (needs review)
  │
  ▼
User clicks "Auto-accept high confidence" → 4 mappings accepted
  │
  ▼
User expands "Station → encounters.ward" row (78%)
  ├── Sees reasoning: "Column likely represents ward/station codes"
  ├── Sees sample value: "A1"
  ├── Clicks Accept
  │
  ▼
Summary bar updates: 5/5 accepted, 92% average confidence
  │
  ▼
User drags "Harmonized Store" node → draws edge from Mapping → Store
  │
  ▼
"Harmonize" button appears in mapping panel
  │
  ▼
User clicks "Harmonize"
  │
  ▼
Progress bar: "Writing 247 rows to care_assessments..."
  │
  ▼
Store node updates: "247 rows written" → green status
  │
  ▼
Chat panel shows AI message: "Harmonization complete. 2 quality alerts generated."
  │
  Done
```

**Edge cases:**
- Multiple sources mapped to same target field: AI flags the conflict in the mapping table; user must choose which source takes priority.
- Source column has no plausible mapping: Shown as "Unmapped" status in the mapping table. User can ask the AI in chat: "Map 'Bemerkung' to care_assessments.notes".
- Harmonization fails (type mismatch): Error shown on store node with specific rows that failed. AI offers to diagnose in the chat panel.

### Flow 3: Multi-Source Mapping

```
Start (two source nodes are profiled: care_assessments.csv and lab_results.xlsx)
  │
  ▼
User drags a Mapping node and connects BOTH sources to it
  │
  ▼
AI analyses both sources together, generates unified mapping suggestions
  │
  ▼
User clicks Mapping node → Mapping Detail Panel shows unified table:
  ├── Source: care_assessments.csv (12 columns → care_assessments table)
  ├── Source: lab_results.xlsx (8 columns → lab_results table)
  ├── Shared entity detected: PatientNr → patients.external_id
  ├── 18 mappings total (15 high confidence, 3 need review)
  │
  ▼
User reviews and confirms mappings (bulk accept + manual review for uncertain fields)
  │
  ▼
User connects Mapping → Store → clicks Harmonize
  │
  ▼
Both sources harmonized into canonical tables with shared patient IDs
  │
  ▼
Chat panel: "494 rows harmonized across 2 tables. Ask me anything about your data."
  │
  Done
```

### Flow 4: Conversational Query with Chart Generation

```
Start (data is harmonized, user deselects all nodes → chat panel is active)
  │
  ▼
Agent panel shows empty state with CareMap AI icon and suggestion buttons
  │
  ▼
User clicks suggestion: "Profile {{src-care}} and map it to our canonical schema"
  │
  ▼
Suggestion populates the input field → user presses Enter to send
  │
  ▼
AI responds with document-stream message:
  │
  ├── Tool Execution Steps (collapsible card):
  │   ├── ⊕ Profiling care_assessments.csv  ✓ Success (0.02s)
  │   ├── ⊕ Mapping to canonical schema     ✓ Success (1.20s)
  │   └── ⊕ Running quality checks          ✓ Success (0.04s)
  │
  ├── Artifact Tabs:
  │   ├── [Overview] Rich text: "Profiling complete. 12 columns, 247 rows.
  │   │    Key findings: high-confidence domain match to care_assessments..."
  │   ├── [247 care_assessments] Interactive data table with scrollable rows
  │   └── [Chart] Bar chart: score distribution by ward
  │
  └── Approval Block: "Accept mapping proposal?" [Accept] [Reject]
  │
  ▼
User clicks "Accept" → approval block updates to green "Accepted"
  │
  ▼
User asks follow-up: "What is the average fall risk score by ward?"
  │
  ▼
AI responds:
  ├── Tool steps: Querying semantic layer → Executing SQL → Generating chart
  ├── Text: "Here's the average fall risk score by ward."
  ├── Artifact tabs with bar chart (horizontal bars, wards on y-axis)
  │
  Done
```

### Flow 5: Anomaly Investigation

```
Start (dashboard shows alert: "3 lab values outside reference range")
  │
  ▼
User clicks the alert
  │
  ▼
Drill-through view shows the 3 affected records:
  ├── Anomalous cells highlighted in red
  ├── Each row shows: patient ID, test name, value, unit, reference range
  │
  ▼
User navigates to canvas → opens chat panel → asks:
  "The creatinine values seem wrong. Can you investigate?"
  │
  ▼
AI responds:
  ├── Tool steps:
  │   ├── ⊕ Tracing lineage for creatinine field   ✓ Success
  │   ├── ⊕ Checking source data format             ✓ Success
  │   └── ⊕ Comparing unit conventions              ✓ Success
  │
  ├── Content: "This appears to be a unit conversion issue. The source data
  │   is in µmol/L (range ~53-106) but was mapped without conversion to
  │   mg/dL. The mapping needs a conversion factor of 0.0113."
  │
  └── Approval: "Update creatinine mapping with unit conversion?"
      [Accept] [Reject]
  │
  ▼
User clicks Accept → AI updates mapping → re-harmonizes
  │
  ▼
AI: "Done. 3 previously anomalous values are now within range.
Quality alert resolved."
  │
  Done
```

---

## 10. User Stories

### Epic 1: Visual Pipeline Building

**US-1.1** As a data steward, I want to drag source nodes onto a canvas so that I can visually construct my data pipeline.

**US-1.2** As a data steward, I want to upload files directly onto source nodes so that I can connect my data without configuring external systems.

**US-1.3** As a data steward, I want to connect nodes with edges so that I can define the flow of data from source to harmonized store.

**US-1.4** As a data steward, I want to see the status of each node at a glance (green/amber/red) so that I know which parts of my pipeline need attention.

**US-1.5** As a data steward, I want to save my pipeline layout so that I can return to it later and re-run it when source data updates.

### Epic 2: AI-Powered Data Profiling

**US-2.1** As a data steward, I want the system to automatically infer column types when I upload a file so that I don't have to manually define schemas.

**US-2.2** As a data steward, I want the system to suggest what clinical domain my data belongs to (e.g., care assessments, lab results) so that I can quickly categorise my sources.

**US-2.3** As a data steward, I want to see a confidence score for each inference so that I know which ones to trust and which to verify.

**US-2.4** As a data steward, I want to correct any incorrect inference directly in the node configuration panel so that I don't need a separate tool.

**US-2.5** As a data steward, I want to see sample values alongside each inference so that I can quickly verify whether the AI's interpretation is correct.

### Epic 3: Intelligent Mapping

**US-3.1** As a data steward, I want the AI to auto-generate mapping suggestions when I connect sources to a mapping node, so I can review them in the Mapping Detail Panel.

**US-3.2** As a data steward, I want each mapping suggestion to include a plain-language explanation and sample values so that I understand why the AI made that suggestion.

**US-3.3** As a data steward, I want to accept, reject, or reset individual mappings via expandable rows in the mapping table so that I retain full control.

**US-3.4** As a data steward, I want to auto-accept high-confidence mappings with one click so that I can move quickly when the AI is right.

**US-3.5** As a data steward, I want the AI to detect overlapping entities when multiple sources connect to one mapper and present a unified mapping, so that I get a unified model rather than duplicates.

**US-3.6** As a data steward, I want to ask the AI to fix mappings using natural language in the chat (e.g., "Map 'Station' to encounters.ward, not patient ID") so that I don't have to hunt through dropdowns.

### Epic 4: Data Harmonization

**US-4.1** As a data steward, I want confirmed mappings to trigger data transformation and loading into the canonical store so that I have a single harmonized dataset.

**US-4.2** As a data steward, I want every harmonized record to trace back to its source file and column so that I can investigate issues.

**US-4.3** As a data steward, I want the system to detect and flag quality issues during harmonization so that I don't silently introduce bad data.

### Epic 5: Conversational Analytics

**US-5.1** As a clinical analyst, I want to ask questions in natural language in the chat panel so that I can query harmonized data without writing SQL.

**US-5.2** As a clinical analyst, I want the AI to show transparent tool execution steps (what it queried, how long it took) so that I can verify the scope of the analysis.

**US-5.3** As a clinical analyst, I want to see charts, tables, and text explanations in tabbed artifact views so that I can quickly understand patterns and trends.

**US-5.4** As a clinical analyst, I want every query result to show execution details (SQL, tables, joins) in expandable tool steps so that I can trust the answer.

**US-5.5** As a clinical analyst, I want to pin useful charts to the dashboard so that I can monitor them without re-asking.

**US-5.6** As a clinical analyst, I want clickable suggestion buttons so that I can explore related insights without typing.

**US-5.7** As a clinical analyst, I want the AI to handle both analysis and mapping fixes in a single conversation, preserving context, so that I can resolve root causes without switching tools.

### Epic 6: Quality Monitoring

**US-6.1** As a clinical analyst, I want a dashboard showing data completeness per field so that I can identify coverage gaps.

**US-6.2** As a clinical analyst, I want to see anomaly alerts ranked by severity so that I can prioritise the most critical issues.

**US-6.3** As a clinical analyst, I want to click an alert and see the affected records so that I can investigate quickly.

**US-6.4** As a data steward, I want quality alerts to tell me which source and mapping produced the issue so that I can fix the root cause.

### Epic 7: AI Experience

**US-7.1** As any user, I want a single unified AI assistant that adapts to my context (canvas vs dashboard) so that I don't have to manually select an agent.

**US-7.2** As any user, I want to see transparent tool execution steps in the conversation so that I always know what the AI did and how.

**US-7.3** As a data steward, I want approval gates for consequential actions (accepting mappings, harmonizing data) so that I can review before data is changed.

**US-7.4** As any user, I want inline entity pills referencing my data assets (tables, columns, sources) so that the conversation is linked to my actual data.

**US-7.5** As any user, I want a context menu on canvas nodes with "Send to Chat" so that I can quickly discuss a specific node with the AI.

**US-7.6** As a first-time user, I want a welcoming empty state with suggestion buttons so that I understand the AI's capabilities immediately.

### Epic 8: On-Premise Readiness

**US-8.1** As an IT administrator, I want to switch the AI model between cloud and local endpoints so that patient data never leaves our network.

**US-8.2** As an IT administrator, I want to test the model connection from the settings page so that I can verify the local deployment works.

**US-8.3** As an IT administrator, I want the application to work identically regardless of which model is selected so that users don't need retraining.

---

## 11. Demo Script (5 Minutes)

This is the exact flow to walk through on stage at START Hack. The demo showcases the conversational AI UX inspired by Zeit AI.

| Time | Action | What the Audience Sees |
|---|---|---|
| 0:00 | Open CareMap, empty canvas | Clean light-themed canvas with "Add a data source" prompt. Chat panel visible on right with CareMap AI. |
| 0:15 | Drag CSV Source, drop care_assessments.csv | Node appears. Right panel switches to source detail: upload → analyzing shimmer → rich data preview with column stats. |
| 0:45 | Click a column header in the data preview | Show AI-inferred type, semantic label, confidence, sample values. Correct a misidentified column inline. |
| 1:00 | Drag Excel Source, drop lab_results.xlsx | Second node profiles automatically. Show auto-profiling. |
| 1:15 | Drag Mapping node, connect both sources to it | Click Mapping node → Mapping Detail Panel: 18 per-field mapping suggestions with confidence bars. |
| 1:45 | Click "Auto-accept high confidence", review one uncertain mapping | Expand a row to see reasoning. Accept it. Show the confidence-based workflow. |
| 2:15 | Connect Mapping → Store, click Harmonize | Progress bar, "494 rows harmonized". Store node turns green. |
| 2:30 | Deselect node → chat panel opens. Type "Average fall risk by ward?" | AI shows tool steps (querying, executing, charting) → artifact tabs with bar chart and data table → full transparency. |
| 3:15 | Pin the chart to dashboard | Toast confirmation, switch to dashboard tab. |
| 3:30 | Show dashboard: pinned chart + built-in quality widgets | Point out KPI cards, completeness heatmap, anomaly feed. |
| 3:45 | Right-click a node → "Send to Chat" | Show the canvas-to-chat bridge: node appears as entity pill in chat. AI responds contextually. |
| 4:00 | Ask about an anomaly in chat | AI traces lineage with transparent tool steps, discovers unit issue. Shows approval block: "Fix mapping?" |
| 4:15 | Open Settings, show model switcher | Dropdown with cloud models + "Custom" with localhost URL. On-prem path. |
| 4:30 | Switch to slides: architecture diagram | Single AI agent, semantic layer, on-prem deployment. |
| 4:45 | Business case slide | 1,400 institutions × harmonized data = digital twin of care. |
| 5:00 | Close | "CareMap: from fragmented data to a unified clinical picture — with an AI you can trust." |
