# CareMap — Technical Requirements & User Flows

**Version:** 1.0 · March 2026

---

# Part A: Technical Requirements Document

---

## 1. System Architecture

CareMap is structured as a monorepo with two workspaces: `apps/web` (Vite + React SPA frontend) and `apps/api` (future Fastify backend). The frontend currently runs entirely on mock data. The backend will communicate with Supabase (Postgres) for data storage and an LLM provider for AI capabilities.

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
│  ├── Dashboard (Recharts + built-in widgets)          │
│  └── Settings (model configuration)                   │
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
             │ (future: REST / streaming APIs)
             ▼
┌───────────────────────────────────────────────────────┐
│            apps/api — Fastify (to be built)            │
│                                                        │
│  API ROUTES                                            │
│  ├── POST /api/ingest      → File parse + AI profiling│
│  ├── POST /api/map         → Mapping suggestions      │
│  ├── POST /api/harmonize   → Data transformation      │
│  ├── POST /api/chat        → Streaming AI responses   │
│  └── GET  /api/dashboard   → Widgets + alerts         │
└────────────┬──────────────────────────────────────────┘
             │
     ┌───────┴────────┐
     ▼                ▼
┌──────────┐   ┌─────────────────┐
│ Supabase │   │  LLM Provider    │
│ (Postgres│   │                  │
│  + Real- │   │  Cloud: GPT-4.1/ │
│  time)   │   │  Claude Sonnet   │
│          │   │  Custom: Ollama  │
└──────────┘   └─────────────────┘
```

### Key Architectural Decision: Single Contextual AI Agent

CareMap uses a **single unified AI agent** ("CareMap AI") rather than multiple named agents. The agent adapts its behaviour based on user context: on the canvas it helps profile sources and map fields, on the dashboard it helps analyze and explore data. There is no agent selector or multi-step workflow stepper in the UI.

The conversation UI follows a **document-stream pattern** inspired by Zeit AI:
- User messages with inline entity references (data assets as interactive pills)
- Agent responses with transparent tool execution steps, rich content, tabbed artifacts (tables, charts), and approval gates
- Full provenance and reasoning for every AI action

Agent tools (to be wired to the backend): `profileSource`, `proposeMappings`, `runQualityCheck`, `executeSQL`, `generateChart`, `explainLineage`. All tools share a common semantic layer stored in Supabase.

### Key Architectural Decision: Dynamic Semantic Layer with Sandbox Hydration

The semantic layer is not a static set of YAML files. It is generated dynamically from user uploads and confirmed mappings.

**Write path (Builder Agent):** User uploads a file → Builder Agent profiles it → profile metadata is written to Supabase (`source_profiles`, `semantic_entities`, `semantic_fields`, `semantic_joins` tables) → user corrects via UI → corrections update the same Supabase rows → when mappings are confirmed and data harmonized, the semantic model is updated.

**Read path (Analyst Agent):** User asks a question in chat → API route spins up a Vercel Sandbox → queries Supabase for the current semantic layer metadata → serializes it into YAML entity files in the sandbox filesystem → agent explores the YAML with `cat`, `grep`, `ls` commands → builds SQL from what it discovers → executes SQL against Supabase canonical tables → streams the result back.

This pattern keeps Supabase as the single source of truth (the frontend reads and writes it normally), while giving the agent the file-based exploration pattern proven by the Vercel OSS Data Analyst reference architecture. The sandbox is ephemeral — each conversation gets a fresh workspace with the latest semantic layer.

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
| Backend (future) | Fastify | — | REST API server (apps/api workspace) |
| Database | Supabase (Postgres) | — | Canonical store, metadata, pipeline state |
| File parsing | Papa Parse | 5.x | CSV parsing |
| File parsing | SheetJS | — | Excel parsing |
| File parsing | pdf-parse | — | PDF text extraction |
| Deployment | Vercel | — | Frontend hosting (connected to GitHub repo) |

---

## 3. Database Schema

### Canonical Clinical Tables

```
patients
  id              UUID, PK
  external_id     TEXT
  birth_year      INT
  gender          TEXT
  created_at      TIMESTAMPTZ

encounters
  id              UUID, PK
  patient_id      UUID → patients
  type            TEXT (inpatient, outpatient, ltc)
  ward            TEXT
  start_date      DATE
  end_date        DATE

diagnoses
  id              UUID, PK
  encounter_id    UUID → encounters
  code            TEXT (ICD-10)
  code_system     TEXT
  description     TEXT
  date            DATE

lab_results
  id              UUID, PK
  encounter_id    UUID → encounters
  test_code       TEXT (LOINC if mapped)
  test_name       TEXT
  value           NUMERIC
  unit            TEXT
  reference_range TEXT
  measured_at     TIMESTAMPTZ

vital_signs
  id              UUID, PK
  encounter_id    UUID → encounters
  type            TEXT (heart_rate, blood_pressure, temperature, spo2)
  value           NUMERIC
  unit            TEXT
  measured_at     TIMESTAMPTZ

medications
  id              UUID, PK
  encounter_id    UUID → encounters
  drug_name       TEXT
  drug_code       TEXT (ATC if mapped)
  dose            NUMERIC
  unit            TEXT
  frequency       TEXT
  start_date      DATE
  end_date        DATE

care_assessments
  id              UUID, PK
  encounter_id    UUID → encounters
  patient_id      UUID → patients
  assessment_type TEXT (mobility, fall_risk, nutrition, pain, pressure_ulcer)
  score           NUMERIC
  scale_min       NUMERIC
  scale_max       NUMERIC
  assessed_at     TIMESTAMPTZ
  assessor        TEXT

care_interventions
  id              UUID, PK
  encounter_id    UUID → encounters
  intervention_type TEXT
  description     TEXT
  start_date      DATE
  end_date        DATE
  status          TEXT (planned, active, completed)

sensor_readings
  id              UUID, PK
  patient_id      UUID → patients
  sensor_type     TEXT
  value           NUMERIC
  unit            TEXT
  measured_at     TIMESTAMPTZ

staff_schedules
  id              UUID, PK
  staff_id        TEXT
  ward            TEXT
  role            TEXT
  shift_start     TIMESTAMPTZ
  shift_end       TIMESTAMPTZ
```

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
  sql_table_name  TEXT
  created_from    JSONB (list of source_file_ids that contributed)
  updated_at      TIMESTAMPTZ

semantic_fields
  id              UUID, PK
  entity_id       UUID → semantic_entities
  field_name      TEXT
  sql_expression  TEXT
  data_type       TEXT
  description     TEXT

semantic_joins
  id              UUID, PK
  from_entity_id  UUID → semantic_entities
  to_entity_id    UUID → semantic_entities
  join_sql        TEXT (e.g., "care_assessments.encounter_id = encounters.id")
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

### POST /api/ingest

Triggered when a file is uploaded to a source node. Parses the file and runs AI profiling.

```
Request:
  Content-Type: multipart/form-data
  Fields: nodeId (string), file (File)

Response:
  Content-Type: text/event-stream (AI SDK data stream)
  Stream contents:
    - { type: "parse_complete", rowCount: 247, columns: ["col1", "col2", ...] }
    - { type: "profile_column", name: "Sturzrisiko_Skala", inferredType: "number",
        semanticLabel: "Fall Risk Score", domain: "care_assessments",
        confidence: 0.92, sampleValues: [0,1,2,3,4], qualityFlags: [] }
    - ... (one per column, streamed)
    - { type: "profile_complete", overallQuality: "good", suggestedLabel: "Care Assessments" }
```

### POST /api/map

Triggered when source nodes are connected to a mapping node. Generates mapping suggestions.

```
Request:
  { nodeId: string, sourceNodeIds: string[] }

Response:
  Content-Type: text/event-stream
  Stream contents:
    - { type: "mapping", sourceColumn: "Sturzrisiko_Skala",
        targetTable: "care_assessments", targetColumn: "score",
        meta: { assessment_type: "fall_risk" },
        confidence: 0.92, reasoning: "Column name = fall risk scale, values 0-4" }
    - ... (one per source column)
    - { type: "semantic_model_update", entities: [...], joins: [...] }
```

### POST /api/harmonize

Triggered when user confirms mappings and clicks "Harmonize".

```
Request:
  { nodeId: string, mappings: FieldMapping[], sourceFileId: string }

Response:
  { recordsWritten: 247, errors: [], qualityAlerts: [...] }
```

### POST /api/chat

Conversational queries via the analyst agent.

```
Request:
  { messages: Message[] }  // Vercel AI SDK message format

Response:
  Content-Type: text/event-stream (AI SDK data stream)
  Stream contents:
    - text deltas (narrative explanation)
    - tool call results (SQL execution, chart specs, lineage)
    - chart specifications (rendered on client by Recharts)
```

### GET /api/dashboard

Fetches current dashboard state.

```
Response:
  {
    widgets: PinnedWidget[],
    alerts: QualityAlert[],
    sources: { id, filename, rowCount, mappedFields, unmappedFields }[]
  }
```

---

## 5. Agent Tool Specifications

CareMap uses a single unified agent with access to all tools. The agent adapts its tool usage based on the user's context and request.

### Data Engineering Tools

**profileSource** — Takes parsed file data (column names, sample rows) and the canonical model definition. Returns structured profiling for each column: inferred type, semantic label, domain, confidence, quality flags. Uses LLM structured output.

**detectDomain** — Takes profiling results and classifies the overall source into a clinical domain (care_assessments, lab_results, vital_signs, etc.). Returns domain label and confidence.

**proposeMappings** — Takes source profile and canonical model definition. Returns mapping suggestions: source column → target table.column, with confidence and reasoning. When multiple sources are provided, also detects overlapping entities and proposes a unified model.

**buildSemanticModel** — Takes confirmed mappings from one or more sources. Generates or updates the semantic layer in Supabase: creates/updates `semantic_entities`, `semantic_fields`, and `semantic_joins` rows.

### Analysis Tools

**readSemanticLayer** — Reads and explores the semantic layer metadata to discover available entities, fields, and joins.

**executeSQL** — Takes a SQL query string and an explanation. Executes against Supabase. Returns result rows (limited to 1000) and metadata (row count, execution time).

**generateChart** — Takes query results, chart type, title, axis labels. Returns a Recharts-compatible JSON specification rendered on the client.

### Shared Tools

**runQualityCheck** — Takes a source file or harmonized table. Returns quality metrics: null rates per column, out-of-range values, duplicate detection, format inconsistencies.

**explainLineage** — Takes a table name and field name. Queries `field_mappings` and `source_files` tables. Returns the chain: source file → source column → mapping rule → transformation → canonical field.

---

## 6. Sandbox Hydration Process

When the analyst agent receives a query:

1. API route queries Supabase for all rows in `semantic_entities`, `semantic_fields`, and `semantic_joins`.
2. Serializes them into YAML files:
   - `catalog.yml` — entity index with descriptions.
   - `entities/{entity_name}.yml` — per-entity file with fields, joins, example questions.
3. Writes these files into the Vercel Sandbox filesystem.
4. Agent is given shell access to the sandbox.
5. Agent explores using `cat semantic/catalog.yml`, `grep -r "fall_risk" semantic/`, etc.
6. Agent builds SQL based on discovered schema.
7. Agent executes SQL against Supabase via the `executeSQL` tool.
8. Sandbox is destroyed after the conversation ends.

Example hydrated entity file:

```yaml
entity: care_assessments
description: >
  Standardized nursing assessments covering mobility, fall risk,
  nutrition, pain, and pressure ulcer risk.
sql_table_name: care_assessments
fields:
  - name: assessment_type
    sql: care_assessments.assessment_type
    type: string
    description: "One of: mobility, fall_risk, nutrition, pain, pressure_ulcer"
  - name: score
    sql: care_assessments.score
    type: number
    description: "Normalized score on the assessment's native scale"
  - name: ward
    sql: encounters.ward
    type: string
    description: "Joined from encounters table"
joins:
  - entity: encounters
    sql: "care_assessments.encounter_id = encounters.id"
  - entity: patients
    sql: "care_assessments.patient_id = patients.id"
example_questions:
  - "What is the average fall risk score by ward?"
  - "Show me patients with mobility score below 2"
```

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
