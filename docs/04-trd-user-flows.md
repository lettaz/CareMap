# CareMap — Technical Requirements & User Flows

**Version:** 1.0 · March 2026

---

# Part A: Technical Requirements Document

---

## 1. System Architecture

CareMap is a single Next.js application with API routes serving as the backend layer. It communicates with Supabase (Postgres) for data storage, Vercel AI SDK for LLM orchestration, Vercel Sandbox for agent execution, and ReactFlow for the visual canvas.

### Architecture Diagram

```
User (Browser)
    │
    ▼
┌───────────────────────────────────────────────────────┐
│               Next.js 14 (App Router)                  │
│                                                        │
│  FRONTEND                                              │
│  ├── Flow Canvas (ReactFlow)                          │
│  ├── Agent Panel (Vercel AI SDK useChat)              │
│  │   ├── Builder Agent (Intent→Plan→Build→Iterate)   │
│  │   └── Analyst Agent (Mission→Scan→Analyze→Report) │
│  ├── Dashboard (Recharts + built-in widgets)          │
│  └── Settings (model configuration)                   │
│                                                        │
│  API ROUTES                                            │
│  ├── /api/ingest      → File parse + AI profiling     │
│  ├── /api/map         → Mapping suggestion generation │
│  ├── /api/harmonize   → Data transformation + write   │
│  ├── /api/chat        → Agent panel conversations      │
│  └── /api/dashboard   → Pinned widgets + alerts       │
│                                                        │
│  AGENTS                                                │
│  ├── Builder Agent    → Profiles, maps, builds model  │
│  └── Analyst Agent    → Queries, charts, lineage      │
└────────────┬──────────────────────────────────────────┘
             │
     ┌───────┴────────┐
     ▼                ▼
┌──────────┐   ┌─────────────────┐
│ Supabase │   │  Vercel Sandbox │
│ (Postgres│   │  (per LLM call) │
│  + Real- │   │                 │
│  time)   │   │  Hydrated YAML  │
│          │   │  semantic layer │
│ Tables:  │   │  + shell access │
│ • canon- │   │  for agent      │
│   ical   │   │  exploration    │
│ • meta-  │   │                 │
│   data   │   └─────────────────┘
│ • pipe-  │            │
│   line   │            │ SQL execution
│   state  │◄───────────┘
└──────────┘
             │
             ▼
┌─────────────────────────┐
│  LLM (via AI Gateway)    │
│                          │
│  Cloud: gpt-4.1 /       │
│    claude-sonnet         │
│  Custom: Ollama / local  │
└─────────────────────────┘
```

### Key Architectural Decision: Two Named Agents, One Semantic Layer

CareMap uses two distinct, user-facing agents that share a common semantic layer. Inspired by Pigment AI's multi-agent architecture (Modeler Agent, Analyst Agent) and Zeit AI's natural-language-first philosophy, both agents are visible in the UI as named collaborators with structured workflows — not hidden backend processes.

**Builder Agent** — Active during pipeline construction. Accessible via the agent panel's Builder tile. Follows a structured **Intent → Plan → Build → Iterate** workflow inspired by Pigment's Modeler Agent. The user describes what they want, the agent proposes a plan, the user approves, and the agent executes. This plan-review-execute loop ensures human oversight on every clinically sensitive decision.

Triggered when files are uploaded, nodes are connected, and mappings are reviewed. Its job is to understand source data and build the semantic model. Tools: `profileSource`, `detectDomain`, `proposeMappings`, `buildSemanticModel`, `runQualityCheck`. Writes to Supabase metadata tables.

**Analyst Agent** — Active during data exploration. Accessible via the agent panel's Analyst tile. Follows a structured **Mission → Scan → Analysis → Report → Outcome** workflow inspired by Pigment's Analyst Agent. The user states their analytical mission, the agent shows which data it will scan, executes the analysis, and delivers a report with follow-up suggestions.

Triggered when users ask questions in the agent panel. Its job is to explore the semantic layer and answer questions about harmonized data. Tools: `readSemanticLayer` (shell exploration in sandbox), `executeSQL`, `generateChart`, `runQualityCheck`, `explainLineage`. Reads from Supabase metadata and canonical tables.

Both agents support natural-language corrections mid-workflow (following Zeit AI's pattern of NL as the universal interface), and both show full provenance for every decision.

### Key Architectural Decision: Dynamic Semantic Layer with Sandbox Hydration

The semantic layer is not a static set of YAML files. It is generated dynamically from user uploads and confirmed mappings.

**Write path (Builder Agent):** User uploads a file → Builder Agent profiles it → profile metadata is written to Supabase (`source_profiles`, `semantic_entities`, `semantic_fields`, `semantic_joins` tables) → user corrects via UI → corrections update the same Supabase rows → when mappings are confirmed and data harmonized, the semantic model is updated.

**Read path (Analyst Agent):** User asks a question in chat → API route spins up a Vercel Sandbox → queries Supabase for the current semantic layer metadata → serializes it into YAML entity files in the sandbox filesystem → agent explores the YAML with `cat`, `grep`, `ls` commands → builds SQL from what it discovers → executes SQL against Supabase canonical tables → streams the result back.

This pattern keeps Supabase as the single source of truth (the frontend reads and writes it normally), while giving the agent the file-based exploration pattern proven by the Vercel OSS Data Analyst reference architecture. The sandbox is ephemeral — each conversation gets a fresh workspace with the latest semantic layer.

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js (App Router) | 14+ | Full-stack React framework |
| Language | TypeScript | 5.x | Type safety across frontend and backend |
| AI SDK | Vercel AI SDK | 6.x | `useChat`, `streamText`, `ToolLoopAgent`, tool definitions |
| AI Gateway | Vercel AI Gateway | — | Model routing, cost tracking, BYOK |
| Sandbox | Vercel Sandbox | — | Ephemeral agent execution environment |
| Canvas | ReactFlow | 12.x | Node-based visual editor |
| Charts | Recharts | 2.x | Chart rendering in chat and dashboard |
| Database | Supabase (Postgres) | — | Canonical store, metadata, pipeline state, realtime |
| File parsing | Papa Parse | 5.x | CSV parsing |
| File parsing | SheetJS | — | Excel parsing |
| File parsing | pdf-parse | — | PDF text extraction |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| Components | shadcn/ui | — | Headless component primitives |
| Deployment | Vercel | — | Hosting, preview deploys, edge functions |

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

### Builder Agent Tools

**profileSource** — Takes parsed file data (column names, sample rows) and the canonical model definition. Returns structured profiling for each column: inferred type, semantic label, domain, confidence, quality flags. Uses LLM structured output.

**detectDomain** — Takes profiling results and classifies the overall source into a clinical domain (care_assessments, lab_results, vital_signs, etc.). Returns domain label and confidence.

**proposeMappings** — Takes source profile and canonical model definition. Returns mapping suggestions: source column → target table.column, with confidence and reasoning. When multiple sources are provided, also detects overlapping entities and proposes a unified model.

**buildSemanticModel** — Takes confirmed mappings from one or more sources. Generates or updates the semantic layer in Supabase: creates/updates `semantic_entities`, `semantic_fields`, and `semantic_joins` rows.

**runQualityCheck** — Takes a source file or harmonized table. Returns quality metrics: null rates per column, out-of-range values, duplicate detection, format inconsistencies.

### Analyst Agent Tools

**readSemanticLayer** — Shell command execution in the sandbox. The agent uses `cat`, `grep`, `ls` to explore hydrated YAML files describing the semantic model. No parameters needed — the agent drives this itself.

**executeSQL** — Takes a SQL query string and an explanation. Executes against Supabase. Returns result rows (limited to 1000) and metadata (row count, execution time).

**generateChart** — Takes query results, chart type, title, axis labels. Returns a Recharts-compatible JSON specification rendered on the client.

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

- Frontend + API routes: Vercel (automatic from Git push)
- Database: Supabase free tier (hosted Postgres)
- LLM: Vercel AI Gateway (cloud models, BYOK)
- Sandbox: Vercel Sandbox (ephemeral per agent call)
- Domain: `caremap.vercel.app` (auto-assigned)

### Production Path (Presentation Only)

- Frontend + API: Docker container in hospital data centre
- Database: PostgreSQL on hospital server
- LLM: Ollama running Llama/Mistral locally (same API shape as OpenAI)
- Sandbox: Local Docker container for agent execution
- Network: Air-gapped, no external calls

---

# Part B: User Flows, Journeys, and Stories

---

## 8. User Journey Map

### Petra (Data Steward) — End-to-End Journey

```
DISCOVER          ONBOARD            CORE TASK                    SUCCESS            RETENTION
─────────────────────────────────────────────────────────────────────────────────────────────
"We need to       Opens CareMap,     Uses Builder Agent:          Data harmonized,   Returns weekly
harmonize our     sees empty         1. Adds source nodes         quality dashboard   to add new
fall risk and     canvas with        2. Uploads files             shows 95%          sources and
lab data for      helpful prompt.    3. Builder Agent proposes    completeness.      review quality.
analytics."       Agent panel           profiling plan            Selects Analyst    Anomaly alerts
                  introduces the     4. Reviews + approves plan   Agent, asks:       prompt her to
                  Builder Agent      5. Agent streams profiles    "avg fall risk     investigate
                  and Analyst.       6. Connects to mapper        by ward?"          with Analyst.
                                     7. Builder proposes          Gets instant
                                        mapping plan              chart with full
                                     8. Reviews, corrects 3       provenance.
                                        uncertain mappings
                                     9. Approves, harmonizes
                                    10. Verifies in dashboard

Emotion:          Emotion:           Emotion:                     Emotion:           Emotion:
Skeptical but     Pleasantly         Impressed — the agent        Satisfied —        Trusts the
hopeful.          surprised by       showed its plan before       this used to       agents. Uses
                  the agent          acting. She corrected        take weeks.        them routinely.
                  onboarding.        it, and it learned.
```

### Daniel (Clinical Analyst) — Query Journey

```
TRIGGER           EXPLORE            ANALYSE                      ACT                SHARE
─────────────────────────────────────────────────────────────────────────────────────────────
Receives alert:   Opens dashboard,   Selects Analyst Agent.       Discovers Ward B   Pins the chart
"Fall risk data   sees anomaly       States mission: "Show        scores spiked      to dashboard.
completeness      in the feed.       fall risk trends by ward,    after a source     Flags the
dropped below     Clicks to see      last 90 days, highlight      format change.     mapping issue
80% for Ward B."  affected records.  wards below 80%."            Asks follow-up:    to Petra for
                                                                  "Was there a       correction.
                                     Agent shows scan plan:       data source
                                     tables + joins. Daniel       change for
                                     approves. Agent runs         Ward B?"
                                     analysis, returns chart      Agent traces
                                     + query plan showing         lineage back
                                     exactly which tables         to the source.
                                     were queried.

Emotion:          Emotion:           Emotion:                     Emotion:           Emotion:
Concerned.        Relieved —         Impressed — he saw           Root cause         Confident the
                  easy to find.      the plan before              found fast.        issue is tracked.
                                     execution. Trusts it.
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

### Flow 2: Mapping and Harmonization (with Builder Agent Plan)

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
Agent panel opens → Builder Agent activates automatically
  │
  ▼
Builder Agent presents PLAN CARD:
  "I'll map 12 columns from care_assessments.csv to the canonical model.
   10 mappings are high confidence (≥85%), 2 need your review."
  ├── [Approve & Execute]  [Edit Plan]
  │
  ▼
User clicks "Approve & Execute"
  │
  ▼
Stepper advances: Intent ✓ → Plan ✓ → Build (active) → Iterate
  │
  ▼
AI generates mapping suggestions (streamed into inspector Mappings tab):
  ├── Sturzrisiko_Skala → care_assessments.score [92%]
  ├── Mobilität → care_assessments.score (mobility) [87%]
  ├── PatientNr → patients.external_id [95%]
  ├── Datum → care_assessments.assessed_at [90%]
  └── Station → encounters.ward [78%] ⚠
  │
  ▼
User clicks "Accept All High Confidence" → 4 mappings accepted
  │
  ▼
User reviews "Station → encounters.ward" (78%)
  ├── Looks at sample values: "A1", "B2", "C3"
  ├── These look like ward codes → clicks Accept
  │
  ▼
Stepper advances to Iterate phase
Builder Agent summarises: "All 5 mappings confirmed. Ready to harmonize."
  │
  ▼
User drags "Harmonized Store" node → draws edge from Mapping → Store
  │
  ▼
"Harmonize" button appears in mapping inspector
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
Quality alerts generated: "2 rows with null assessment date"
  │
  ▼
Builder Agent: "Harmonization complete. 2 quality alerts generated.
Would you like me to investigate the null dates?"
  │
  Done
```

**Edge cases:**
- Multiple sources mapped to same target field: Builder Agent flags the conflict in its plan; user must choose which source takes priority or how to merge.
- Source column has no plausible mapping: Builder Agent marks as "Unmapped" in plan, with option to skip or manually assign via NL correction ("Map 'Bemerkung' to care_assessments.notes").
- Harmonization fails (type mismatch): Error shown on store node with specific rows that failed. Builder Agent offers to diagnose and propose a corrected mapping plan.

### Flow 3: Multi-Source Mapping (with Unified Agent Plan)

```
Start (two source nodes are profiled: care_assessments.csv and lab_results.xlsx)
  │
  ▼
User drags a Mapping node and connects BOTH sources to it
  │
  ▼
Agent panel opens → Builder Agent activates
  │
  ▼
Builder Agent presents UNIFIED PLAN CARD:
  "I've analysed both sources together. Here's my plan:
   1. Map 12 columns from care_assessments.csv → care_assessments table
   2. Map 8 columns from lab_results.xlsx → lab_results table
   3. Both share a 'PatientNr' column — I'll create a shared patient entity
   4. Proposed joins: patients ↔ encounters ↔ care_assessments
                      patients ↔ encounters ↔ lab_results
   18 mappings total (15 high confidence, 3 need review)"
  ├── [Approve & Execute]  [Edit Plan]
  │
  ▼
User reviews plan, approves
  │
  ▼
Inspector shows unified semantic model proposal:
  ├── Entities: patients, encounters, care_assessments, lab_results
  ├── Joins: patients ↔ encounters ↔ care_assessments
  │          patients ↔ encounters ↔ lab_results
  ├── Field mappings per source (two sub-tables)
  │
  ▼
User reviews and confirms mappings (bulk accept + manual review)
  │
  ▼
Semantic model written to Supabase metadata tables
  │
  ▼
User connects Mapping → Store → clicks Harmonize
  │
  ▼
Both sources harmonized into canonical tables with shared patient IDs
  │
  ▼
Builder Agent: "494 rows harmonized across 2 tables.
Your data is now queryable — switch to the Analyst Agent to explore it."
  │
  Done
```

### Flow 4: Analyst Agent Query with Chart Generation

```
Start (data is harmonized, user opens agent panel)
  │
  ▼
Agent panel shows two tiles: Builder Agent, Analyst Agent
  │
  ▼
User selects Analyst Agent tile → agent activates
  │
  ▼
Suggested prompt chips appear: "Average fall risk by ward", "Data completeness overview"
  │
  ▼
User types: "What is the average fall risk score by ward for the last 30 days?"
  │
  ▼
MISSION phase: Agent confirms mission scope
  "I'll analyse fall risk scores grouped by ward for the last 30 days."
  │
  ▼
SCAN phase: Agent shows data plan card:
  "Tables: care_assessments, encounters
   Join: care_assessments.encounter_id = encounters.id
   Filter: assessment_type = 'fall_risk', assessed_at ≥ 30 days ago"
  │
  ▼
ANALYSIS phase: Agent executes (streamed):
  ├── Hydrates semantic layer into sandbox
  ├── Explores: cat semantic/catalog.yml
  ├── Explores: cat semantic/entities/care_assessments.yml
  ├── Discovers: score field, ward join via encounters
  ├── Builds SQL: SELECT e.ward, AVG(ca.score) FROM care_assessments ca
  │               JOIN encounters e ON ca.encounter_id = e.id
  │               WHERE ca.assessment_type = 'fall_risk'
  │               AND ca.assessed_at >= now() - interval '30 days'
  │               GROUP BY e.ward ORDER BY AVG(ca.score) DESC
  ├── Executes SQL → gets results
  ├── Generates bar chart spec
  │
  ▼
REPORT phase: Response renders:
  ├── Text: "Here's the average fall risk score by ward over the last 30 days.
  │          Ward B has the highest average score at 2.8."
  ├── Bar chart: wards on x-axis, avg score on y-axis
  ├── 📌 Pin to Dashboard button on the chart
  ├── ▸ Execution Details (collapsed): SQL + tables + "Data freshness: 5 min ago"
  │
  ▼
OUTCOME phase: Agent suggests follow-ups:
  ├── [chip] "Which patients in Ward B have the highest risk?"
  ├── [chip] "How has Ward B's score changed over 90 days?"
  ├── [chip] "Compare fall risk vs staffing levels by ward"
  │
  ▼
User clicks 📌 → toast: "Pinned to dashboard"
  │
  Done
```

### Flow 5: Anomaly Investigation (Cross-Agent Handoff)

```
Start (dashboard shows alert: "3 lab values outside reference range")
  │
  ▼
User clicks the alert
  │
  ▼
Drill-through panel opens:
  ├── Filtered table showing the 3 affected records
  ├── Anomalous cells highlighted in red
  ├── Each row shows: patient ID, test name, value, unit, reference range
  │
  ▼
User clicks "Investigate with Analyst" on one record
  │
  ▼
Agent panel opens → Analyst Agent activates with pre-populated mission:
  "I'm looking at lab result [id]. The creatinine value is 15.2 mg/dL
   but the reference range is 0.6-1.2. Is this a data mapping issue
   or a genuine outlier?"
  │
  ▼
Analyst Agent investigates (Mission → Scan → Analysis → Report):
  ├── SCAN: "I'll check the lineage for this record: source file, column,
  │          mapping transformation, and the original value."
  ├── ANALYSIS: Traces lineage via explainLineage tool
  ├── Discovers: source file uses µmol/L, mapping didn't include unit conversion
  ├── REPORT: "This appears to be a unit conversion issue. The source data
  │            is in µmol/L (range ~53-106) but was mapped without conversion
  │            to mg/dL. The mapping needs a conversion factor of 0.0113."
  ├── OUTCOME suggests: [chip] "Fix this mapping with Builder Agent"
  │
  ▼
User clicks "Fix this mapping with Builder Agent" → agent panel switches
  │
  ▼
Builder Agent activates with context pre-loaded:
  "The creatinine mapping from lab_results.xlsx needs a unit conversion.
   Here's my plan:
   1. Update the mapping transformation: value * 0.0113
   2. Re-harmonize affected rows
   3. Re-run quality check to verify"
  ├── [Approve & Execute]  [Edit Plan]
  │
  ▼
User approves → Builder Agent fixes mapping → re-harmonizes
  │
  ▼
Builder Agent: "Done. 3 previously anomalous values are now within range.
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

### Epic 3: Intelligent Mapping (with Builder Agent Plans)

**US-3.1** As a data steward, I want the Builder Agent to propose a structured mapping plan when I connect sources to a mapping node, so that I can review the strategy before individual mappings are generated.

**US-3.2** As a data steward, I want each mapping suggestion to include a plain-language explanation so that I understand why the AI made that suggestion.

**US-3.3** As a data steward, I want to accept, reject, or edit individual mappings so that I retain full control over how my data is harmonized.

**US-3.4** As a data steward, I want to bulk-accept high-confidence mappings so that I can move quickly when the AI is right.

**US-3.5** As a data steward, I want the Builder Agent to detect overlapping entities when multiple sources connect to one mapper and present a unified plan, so that I get a unified model rather than duplicates.

**US-3.6** As a data steward, I want to correct the Builder Agent's mapping decisions using natural language (e.g., "Map 'Station' to encounters.ward, not patient ID") so that I don't have to hunt through dropdowns.

### Epic 4: Data Harmonization

**US-4.1** As a data steward, I want confirmed mappings to trigger data transformation and loading into the canonical store so that I have a single harmonized dataset.

**US-4.2** As a data steward, I want every harmonized record to trace back to its source file and column so that I can investigate issues.

**US-4.3** As a data steward, I want the system to detect and flag quality issues during harmonization so that I don't silently introduce bad data.

### Epic 5: Agent-Driven Analytics (Analyst Agent)

**US-5.1** As a clinical analyst, I want to select the Analyst Agent and state my mission in natural language so that I can query harmonized data without writing SQL.

**US-5.2** As a clinical analyst, I want the Analyst Agent to show me which tables and joins it plans to use (Scan phase) before executing, so that I can verify the scope of the analysis.

**US-5.3** As a clinical analyst, I want to see charts alongside text explanations so that I can quickly understand patterns and trends.

**US-5.4** As a clinical analyst, I want every query result to show execution details (SQL, tables, joins, data freshness) so that I can trust the answer.

**US-5.5** As a clinical analyst, I want to pin useful charts to the dashboard so that I can monitor them without re-asking.

**US-5.6** As a clinical analyst, I want the Analyst Agent to suggest follow-up questions after each result (Outcome phase) so that I can explore related insights.

**US-5.7** As a clinical analyst, I want the Analyst Agent to hand off to the Builder Agent when a data mapping fix is needed, preserving context, so that I can resolve root causes without starting over.

### Epic 6: Quality Monitoring

**US-6.1** As a clinical analyst, I want a dashboard showing data completeness per field so that I can identify coverage gaps.

**US-6.2** As a clinical analyst, I want to see anomaly alerts ranked by severity so that I can prioritise the most critical issues.

**US-6.3** As a clinical analyst, I want to click an alert and see the affected records so that I can investigate quickly.

**US-6.4** As a data steward, I want quality alerts to tell me which source and mapping produced the issue so that I can fix the root cause.

### Epic 7: Agent Experience

**US-7.1** As any user, I want to see two named agents (Builder and Analyst) as selectable tiles in the agent panel so that I know which AI capability to use.

**US-7.2** As any user, I want the active agent to show a structured workflow stepper (Intent→Plan→Build→Iterate or Mission→Scan→Analysis→Report→Outcome) so that I always know where I am in the process.

**US-7.3** As a data steward, I want the Builder Agent to present a plan before executing so that I can review and approve before any data is changed.

**US-7.4** As a clinical analyst, I want the Analyst Agent to show which data sources it will query (Scan phase) before executing so that I can verify scope.

**US-7.5** As any user, I want agents to hand off to each other with preserved context (e.g., Analyst detects a mapping issue → hands off to Builder to fix it) so that I don't lose my train of thought.

**US-7.6** As a first-time user, I want a brief onboarding card explaining the two agents so that I understand the agent panel immediately.

### Epic 8: On-Premise Readiness

**US-8.1** As an IT administrator, I want to switch the AI model between cloud and local endpoints so that patient data never leaves our network.

**US-8.2** As an IT administrator, I want to test the model connection from the settings page so that I can verify the local deployment works.

**US-8.3** As an IT administrator, I want the application to work identically regardless of which model is selected so that users don't need retraining.

---

## 11. Demo Script (5 Minutes)

This is the exact flow to walk through on stage at START Hack. The demo now showcases the agent-first UX inspired by Pigment AI and Zeit AI.

| Time | Action | What the Audience Sees |
|---|---|---|
| 0:00 | Open CareMap, empty canvas | Clean light-themed canvas with "Add a data source" prompt. Agent panel visible on right with Builder and Analyst tiles. |
| 0:15 | Drag CSV Source, drop care_assessments.csv | Node appears on white canvas. Builder Agent activates — proposes profiling plan. User approves. AI profiling streams in. |
| 0:45 | Show one correction in the profile panel | Demonstrate human-in-the-loop: correct a misidentified column. Mention: "The agent showed its plan first — I approved before it ran." |
| 1:00 | Drag Excel Source, drop lab_results.xlsx | Second node profiles automatically. Builder Agent updates its plan. |
| 1:15 | Drag Mapping node, connect both sources to it | Builder Agent presents a unified mapping plan: "18 mappings across 2 sources, 15 high confidence, 3 need review." User approves. |
| 1:45 | Bulk accept high confidence, manually review one uncertain mapping | Show the confidence-based workflow + NL correction: type "Map 'Station' to encounters.ward" in the agent panel. |
| 2:15 | Connect Mapping → Store, click Harmonize | Progress bar, "494 rows harmonized". Builder Agent summarises: "Done. Switch to Analyst Agent to query your data." |
| 2:30 | Select Analyst Agent, type "Average fall risk score by ward?" | Analyst workflow: Mission confirmed → Scan shows tables → Analysis runs → Bar chart renders with full provenance. |
| 3:15 | Pin the chart to dashboard | Toast confirmation, switch to dashboard tab. |
| 3:30 | Show dashboard: pinned chart + built-in quality widgets | Point out completeness heatmap, anomaly feed. |
| 3:45 | Click an anomaly alert → "Investigate with Analyst" | Analyst traces lineage, discovers unit conversion issue. Suggests: "Fix with Builder Agent." |
| 4:00 | Show cross-agent handoff: Analyst → Builder | Builder Agent proposes a fix plan. Approve → mapping corrected → re-harmonized. "Two agents, one workflow." |
| 4:15 | Open Settings, show model switcher | Dropdown with cloud models + "Custom" with localhost URL. Quick mention of on-prem path. |
| 4:30 | Switch to slides: architecture diagram | Two agents, one semantic layer. On-prem deployment path. |
| 4:45 | Business case slide | 1,400 institutions × harmonized data = digital twin of care. |
| 5:00 | Close | "CareMap: from fragmented data to a unified clinical picture — with AI agents you can trust." |
