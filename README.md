# CareMap

**AI-native healthcare data harmonization platform.**

CareMap takes messy, multi-format clinical datasets from different hospital systems and turns them into clean, unified, queryable data — with an AI agent doing the heavy lifting while keeping the human in the loop.

Built for the [START Hack 2026](https://www.starthack.eu/) epaCC challenge.

---

## The Problem

Hospitals export clinical data in wildly different formats — German column names, inconsistent date formats, mixed delimiters, varying ID schemes. A single clinic might produce 7+ separate files (labs, medications, nursing notes, device telemetry, ICD/OPS codes, epaAC assessments, etc.), and when you need to combine data across 4 clinics, you're looking at 28+ files that don't speak the same language.

Traditional ETL requires a data engineer to manually inspect each file, write transformation scripts, validate joins, and repeat the process every time the source format changes.

## The Solution

CareMap replaces manual ETL with an **AI agent that acts as a data engineer**. The user uploads files, and the AI:

1. **Profiles** every column — detects types, computes statistics, assigns clinical semantic labels (even translating German column names), and handles unnamed/malformed headers automatically
2. **Proposes a target schema** — analyzes all source profiles and designs an optimal normalized relational schema tailored to the actual data (not a hardcoded template)
3. **Proposes cleaning** — suggests fixes for type mismatches, null handling, date parsing, string normalization
4. **Maps columns** across sources to the user-approved target schema with confidence scores and transformation rules
5. **Harmonizes** approved mappings into queryable output files via isolated Python sandboxes
6. **Answers questions** in natural language — "How many patients had a fall risk score above 3 in Q2 2024?"

The user sees everything the AI is doing in real-time via streamed tool steps, and approves or rejects destructive operations before they execute (unless **YOLO mode** is enabled).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │   Canvas      │  │  Dashboard   │  │   AI Chat Panel       │  │
│  │  (ReactFlow)  │  │  (Recharts)  │  │  (Vercel AI SDK)      │  │
│  │              │  │              │  │                       │  │
│  │  Source nodes │  │  Pinned      │  │  Tool steps           │  │
│  │  Map nodes    │  │  artifacts   │  │  Approval gates       │  │
│  │  Harmonize    │  │  Quality     │  │  Artifact viewer      │  │
│  │  nodes        │  │  alerts      │  │  Entity references    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘  │
│         │                 │                      │               │
└─────────┼─────────────────┼──────────────────────┼───────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FASTIFY API (apps/api)                       │
│                                                                  │
│  Routes ──────────────────────────────────────────────────────── │
│  │ /ingest      → Parse + Profile (Native TS + LLM)            │ │
│  │ /chat        → AI Agent (Streaming SSE)                      │ │
│  │ /pipeline    → Agent-driven pipeline triggers                │ │
│  │ /projects    → CRUD + Pipeline state + Semantic layer        │ │
│  │ /schemas     → Dynamic target schema CRUD + activation       │ │
│  │ /step-logs   → Pipeline observability timeline               │ │
│  │ /dashboard   → Pinned widgets + Quality alerts               │ │
│  │ /harmonize   → Trigger harmonization (SSE)                   │ │
│                                                                  │
│  AI Agent (ToolLoopAgent) ──────────────────────────────────── │
│  │ 14 tools across 4 execution tiers:                          │ │
│  │                                                              │ │
│  │ Native TS:  parse_file, profile_columns, run_quality_check  │ │
│  │ LLM:        suggest_cleaning, propose_target_schema,        │ │
│  │             propose_mappings, explain_lineage,               │ │
│  │             generate_artifact                                │ │
│  │ E2B:        execute_cleaning, run_harmonization,            │ │
│  │             run_query, run_script                           │ │
│  │ Supabase:   confirm_mappings, update_semantic               │ │
│                                                                  │
│  Services ─────────────────────────────────────────────────────│
│  │ profiler.ts   → Column stats + LLM semantic enrichment     │ │
│  │ cleaner.ts    → Pandas script generation + E2B execution   │ │
│  │ mapper.ts     → LLM-driven column mapping against dynamic  │ │
│  │                 project schema                              │ │
│  │ harmonizer.ts → Pandas transforms → CSV in E2B             │ │
│  │ query.ts      → DuckDB SQL on data files in E2B            │ │
│  │ sandbox.ts    → E2B lifecycle, retry logic, signed URLs    │ │
│  │ semantic.ts   → Semantic layer assembly for agent context   │ │
│  │ storage.ts    → Supabase Storage wrapper                   │ │
│  │ step-logger   → Pipeline step observability                │ │
│                                                                  │
└────────┬──────────────────┬──────────────────────┬──────────────┘
         │                  │                      │
         ▼                  ▼                      ▼
┌─────────────┐   ┌─────────────────┐   ┌──────────────────────┐
│   OpenAI     │   │   Supabase       │   │   E2B Sandbox        │
│   GPT-5.2    │   │                  │   │                      │
│   Codex      │   │  Postgres:       │   │  Python 3.13         │
│              │   │  ├ projects      │   │  ├ pandas             │
│  Reasoning + │   │  ├ source_files  │   │  ├ DuckDB             │
│  Code gen    │   │  ├ profiles      │   │  ├ NumPy / SciPy      │
│              │   │  ├ mappings      │   │                      │
│              │   │  ├ target_schemas│   │  Isolated per-request │
│              │   │  ├ pipeline      │   │  Retry w/ backoff     │
│              │   │  ├ step_logs     │   │  120s timeout (harm.) │
│              │   │  ├ semantic      │   │                      │
│              │   │  ├ conversations │   │  Loads files via      │
│              │   │  └ alerts        │   │  signed URLs from     │
│              │   │                  │   │  Supabase Storage     │
│              │   │  Storage:        │   │                      │
│              │   │  ├ raw/ (CSV)    │   │                      │
│              │   │  ├ cleaned/      │   │                      │
│              │   │  └ harmonized/   │   │                      │
└─────────────┘   └─────────────────┘   └──────────────────────┘
```

### Key Design Decisions

| Decision | Why |
|---|---|
| **Metadata vs Data separation** | Postgres stores only structure (profiles, mappings, pipeline state). Actual data rows never enter the database — they live as files in object storage. |
| **E2B sandboxes for data ops** | All data manipulation (cleaning, harmonization, querying) runs in isolated Python sandboxes. The backend never loads patient data into its own process. |
| **Dynamic target schemas** | The AI proposes a schema based on the actual data rather than mapping to a hardcoded template. Users review and edit before activating. |
| **Human-in-the-loop** | Safe operations (profiling, querying) run automatically. Destructive operations (cleaning, mapping confirmation, harmonization) pause and ask for user approval — unless YOLO mode is on. |
| **Structured error responses** | All tools return `{ success, error, retryable, suggestion }` so the AI agent can reason about failures, retry transient errors, and give the user actionable guidance. |
| **Retry with backoff** | E2B sandbox calls retry up to 2× on transient failures (port not open, network reset, timeouts) with exponential backoff. |

---

## Data Flow

```
                    ┌─────────────┐
                    │  User drops  │
                    │  CSV / XLSX  │
                    └──────┬──────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  1. PARSE + PROFILE     │
              │                        │
              │  PapaParse / xlsx       │  ← Native TypeScript
              │  Auto-name unnamed     │
              │  columns (unnamed_1)   │
              │  Column stats (nulls,  │
              │  uniques, types)       │
              │         +              │
              │  LLM semantic labels   │  ← GPT-5.2-codex
              │  ("FallID" → Case ID)  │
              │                        │
              │  Step logs recorded    │  ← Observability
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  2. PROPOSE SCHEMA      │  ← NEW
              │                        │
              │  AI analyzes all source │  ← LLM designs
              │  profiles and designs  │
              │  normalized target     │
              │  tables (e.g. patients,│
              │  encounters, labs...)  │
              │                        │
              │  Saved as draft        │
              │  User reviews + edits  │  ← Human-in-the-loop
              │  User activates ✓      │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  3. CLEAN               │
              │                        │
              │  AI proposes plan:     │  ← LLM suggests
              │  - Parse dates         │
              │  - Normalize IDs       │
              │  - Fill nulls          │
              │                        │
              │  User approves ✓       │  ← or YOLO mode
              │                        │
              │  pandas executes in    │  ← E2B Sandbox
              │  isolated sandbox      │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  4. MAP                 │
              │                        │
              │  AI reads all source   │  ← LLM proposes
              │  profiles and proposes │
              │  source → target       │
              │  column mappings       │
              │  against the ACTIVE    │
              │  project schema        │
              │                        │
              │  Confidence scores     │
              │  + transformation      │
              │  rules (casts, renames)│
              │                        │
              │  User reviews,         │  ← Target-centric UI
              │  accepts / rejects     │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  5. HARMONIZE           │
              │                        │
              │  Deterministic:        │  ← E2B Sandbox
              │  - Column renames      │
              │  - Type casts          │
              │  - SQL-to-pandas       │
              │    translation         │
              │  - Auto-detect CSV     │
              │    delimiters          │
              │  - Deduplicate cols    │
              │  → CSV per target      │
              │    table               │
              │                        │
              │  Semantic layer        │  ← Supabase metadata
              │  updated (tables,      │
              │  fields, joins)        │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  6. QUERY               │
              │                        │
              │  "How many patients    │
              │   had fall risk > 3?"  │
              │                        │
              │  AI writes DuckDB SQL  │  ← LLM generates
              │  → Runs on data files  │  ← E2B Sandbox
              │  → JSON results        │
              │  → Optional chart      │  ← Pinnable to dashboard
              └────────────────────────┘
```

---

## Tech Stack

### Frontend (`apps/web`)

| Layer | Technology |
|---|---|
| Framework | Vite 8 + React 19 + TypeScript 5.9 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4, Inter + Geist Mono fonts |
| Components | shadcn/ui (Base UI React) |
| Canvas | ReactFlow 12 (node-based pipeline builder) |
| Charts | Recharts 3 |
| State | Zustand 5 (project-scoped stores) |

### Backend (`apps/api`)

| Layer | Technology |
|---|---|
| Server | Fastify 5 + TypeScript 5.9 |
| AI | Vercel AI SDK 6, GPT-5.2-codex |
| Sandbox | E2B Code Interpreter (Python 3.13, pandas, DuckDB) |
| Database | Supabase Postgres (metadata only) |
| Storage | Supabase Storage (raw CSV, cleaned/harmonized files) |
| Validation | Zod 3 |
| File parsing | PapaParse, xlsx |

### Infrastructure

| Service | Purpose |
|---|---|
| Supabase | Postgres + Storage + Auth (future) |
| E2B | Isolated Python sandboxes for data ops |
| OpenAI | GPT-5.2-codex for code generation + reasoning |
| Railway | Backend hosting (Fastify API) |
| Vercel | Frontend hosting |

---

## Project Structure

```
CareMap/
├── apps/
│   ├── api/                          # Fastify backend
│   │   ├── src/
│   │   │   ├── config/               # AI model, env, Supabase clients
│   │   │   ├── lib/                  # Error classes, YOLO mode, step logger
│   │   │   ├── routes/               # HTTP endpoints
│   │   │   │   ├── chat.ts           # AI agent streaming
│   │   │   │   ├── ingest.ts         # File upload + profiling (SSE)
│   │   │   │   ├── pipeline.ts       # Agent-driven pipeline triggers
│   │   │   │   ├── schemas.ts        # Target schema CRUD + activation
│   │   │   │   ├── step-logs.ts      # Pipeline observability
│   │   │   │   ├── projects.ts       # Project CRUD + settings
│   │   │   │   └── ...
│   │   │   ├── services/             # Business logic
│   │   │   │   ├── agent.ts          # ToolLoopAgent + system prompt
│   │   │   │   ├── sandbox.ts        # E2B wrapper + retry + safety
│   │   │   │   ├── profiler.ts       # Parse + profile + column normalization
│   │   │   │   ├── cleaner.ts        # Cleaning script gen + exec
│   │   │   │   ├── mapper.ts         # Dynamic schema mapping
│   │   │   │   ├── harmonizer.ts     # Harmonization orchestration
│   │   │   │   ├── query.ts          # Multi-stage DuckDB queries
│   │   │   │   └── tools/            # 14 AI SDK tool definitions
│   │   │   └── server.ts             # Fastify entry point
│   │   ├── supabase/migrations/      # SQL schema (4 migrations)
│   │   ├── e2b/Dockerfile            # Custom sandbox image
│   │   └── .env.example
│   │
│   └── web/                          # Vite + React frontend
│       └── src/
│           ├── components/
│           │   ├── canvas/           # ReactFlow nodes, edges, inspector
│           │   ├── agent/            # Chat UI, tool steps, artifacts
│           │   ├── dashboard/        # Widgets, alerts
│           │   └── ui/               # shadcn primitives
│           ├── lib/                  # Stores, utils
│           └── routes/               # Route pages
│
├── data/                             # Sample clinical datasets
│   └── split_data_pat_case_altered/  # 4 clinics × 7 file types
│
└── docs/                             # Architecture + design specs
    ├── 01-solution-overview.md
    ├── 02-prd.md
    ├── 03-design-specs.md
    ├── 04-trd-user-flows.md
    ├── 05-fe-handover.md
    └── 06-backend-architecture.md
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- A [Supabase](https://supabase.com) project
- An [E2B](https://e2b.dev) account
- An [OpenAI](https://platform.openai.com) API key (with GPT-5.2-codex access)

### Setup

```bash
# Clone
git clone https://github.com/lettaz/CareMap.git
cd CareMap

# Install dependencies (npm workspaces)
npm install

# Configure backend environment
cp apps/api/.env.example apps/api/.env
# Fill in your keys — see "Environment Variables" below

# Run database migrations (in order)
# Use Supabase dashboard SQL editor or CLI:
#   001_initial_schema.sql
#   002_conversations.sql
#   003_pipeline_step_logs.sql
#   004_target_schemas.sql

# Start backend
npm run dev -w api        # → http://localhost:3001

# Start frontend (separate terminal)
npm run dev -w web        # → http://localhost:5173
```

### Environment Variables

| Variable | Required | Where to get it |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase dashboard → Settings → API → Service Role Key |
| `OPENAI_API_KEY` | Yes | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `E2B_API_KEY` | Yes | [e2b.dev/dashboard](https://e2b.dev/dashboard) |
| `LLM_PROVIDER` | No | `openai` (default), `anthropic`, or `custom` |
| `LLM_MODEL` | No | Model name (default `gpt-5.2-codex`) |
| `E2B_TEMPLATE_ID` | No | Custom E2B template (default `code-interpreter-v1`) |
| `CORS_ORIGIN` | No | Frontend origin (default `http://localhost:5173`) |
| `PORT` | No | API port (default `3001`) |

---

## API Overview

### Core Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/api/projects` | GET, POST | List / create projects |
| `/api/projects/:id` | PATCH, DELETE | Update settings (incl. YOLO mode) / delete |
| `/api/projects/:id/pipeline` | GET, PUT | Load / save canvas state |
| `/api/projects/:id/semantic` | GET | Full semantic layer context |
| `/api/projects/:id/conversations` | GET, POST | Conversation history |
| `/api/ingest` | POST | Upload file + stream profiling (SSE) |
| `/api/chat` | POST | AI agent conversation (SSE) |
| `/api/projects/:id/pipeline/trigger` | POST | Trigger agent-driven pipeline ops (SSE) |
| `/api/dashboard` | GET | Dashboard data (widgets, alerts, sources) |
| `/api/dashboard/artifacts/pin` | POST | Pin chart artifact from chat |
| `/api/harmonize` | POST | Trigger harmonization (SSE) |

### Schema Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/projects/:id/schema` | GET | Get active or latest draft schema |
| `/api/projects/:id/schemas` | GET | List all schema versions |
| `/api/projects/:id/schema` | POST | Create new schema (AI or manual) |
| `/api/projects/:id/schema/:schemaId` | PATCH | Edit schema tables/columns |
| `/api/projects/:id/schema/:schemaId/activate` | POST | Activate a schema (archives previous) |

### Observability Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/projects/:id/nodes/:nodeId/steps` | GET | Step logs for a pipeline node |
| `/api/projects/source-files/:id/steps` | GET | Step logs for a source file |

---

## AI Agent Tools

The agent has 14 tools organized by execution tier:

| Tool | Tier | Approval | Description |
|---|---|---|---|
| `parse_file` | Native TS | No | Parse uploaded CSV/XLSX, auto-name unnamed columns |
| `profile_columns` | Native TS | No | Compute column statistics + semantic labels |
| `run_quality_check` | Native TS | No | Check data quality issues |
| `suggest_cleaning` | LLM | No | Propose cleaning plan (fixed function library) |
| `propose_target_schema` | LLM | No | Design target schema from source profiles |
| `propose_mappings` | LLM | No | Propose source → target column mappings |
| `explain_lineage` | LLM | No | Explain data lineage and transformations |
| `generate_artifact` | LLM | No | Generate chart specification from query results |
| `execute_cleaning` | E2B | **Dynamic** | Run pandas cleaning in sandbox |
| `run_harmonization` | E2B | **Dynamic** | Run harmonization, write output files |
| `run_query` | E2B | No | Execute DuckDB SQL on data files |
| `run_script` | E2B | **Yes** | Run arbitrary Python script |
| `confirm_mappings` | Supabase | **Dynamic** | Persist accepted/rejected mappings |
| `update_semantic` | Supabase | No | Update semantic layer metadata |

**Dynamic approval**: Tools marked "Dynamic" respect the project's YOLO mode setting. When YOLO mode is enabled in project settings, these tools execute without pausing for user confirmation.

### Error Handling

All tools return structured responses:

```json
{
  "success": true,
  "...result fields..."
}
```

On failure:

```json
{
  "success": false,
  "error": "what went wrong",
  "retryable": true,
  "suggestion": "what the agent or user should do next"
}
```

The agent is instructed to retry transient failures once and always report persistent errors to the user with actionable guidance.

---

## Pipeline Triggers

The pipeline trigger endpoint (`POST /api/projects/:id/pipeline/trigger`) accepts an action and auto-resolves necessary IDs from the pipeline graph:

| Action | When fired | What the agent does |
|---|---|---|
| `upload_complete` | After file upload + profiling | Profile columns, summarize data quality |
| `suggest_cleaning_requested` | User requests cleaning for a profiled file | Propose a cleaning plan |
| `sources_connected` | User draws edges to a mapping node | Propose target schema (if none) or propose mappings |
| `harmonize_requested` | User triggers harmonization | Run harmonization with accepted mappings |

---

## Database Schema

4 SQL migrations in `apps/api/supabase/migrations/`:

| Migration | Tables |
|---|---|
| `001_initial_schema.sql` | `projects`, `source_files`, `source_profiles`, `field_mappings`, `pipeline_nodes`, `pipeline_edges`, `semantic_entities`, `semantic_fields`, `semantic_joins`, `quality_alerts`, `dashboard_widgets` |
| `002_conversations.sql` | `conversations`, `conversation_messages` |
| `003_pipeline_step_logs.sql` | `pipeline_step_logs` (observability) |
| `004_target_schemas.sql` | `target_schemas` (dynamic schema per project) |

---

## Sample Data

The `data/` directory contains real clinical test data from the epaCC challenge — 4 Swiss clinics, each with up to 7 file types:

| File Type | Content | Format |
|---|---|---|
| `device.csv` | Patient movement and fall monitoring | Time series |
| `device_1hz.csv` | Bed sensor accelerometer data (1Hz) | High-frequency time series |
| `epaAC-Data.csv` | Clinical assessment items (German) | Semicolon-delimited |
| `icd_ops.csv` | ICD-10 diagnoses + OPS procedure codes | Structured |
| `labs.csv` | Lab results with reference ranges and flags | Structured |
| `medication.csv` | Medication orders and administrations | Structured |
| `nursing.csv` | Free-text nursing shift notes | Unstructured |

---

## Deployment

### Backend (Railway)

The Fastify API is designed to run on [Railway](https://railway.app):

```bash
# Required environment variables in Railway:
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
OPENAI_API_KEY=...
E2B_API_KEY=...
CORS_ORIGIN=https://your-frontend-domain.vercel.app
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
```

### Frontend (Vercel)

The Vite SPA deploys to [Vercel](https://vercel.com) with the API URL configured as an environment variable.

---

## License

MIT
