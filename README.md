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

1. **Profiles** every column — detects types, computes statistics, assigns clinical semantic labels (even translating German column names)
2. **Proposes cleaning** — suggests fixes for type mismatches, null handling, date parsing, string normalization
3. **Maps columns** across sources to a unified target schema with confidence scores
4. **Harmonizes** approved mappings into queryable Parquet files
5. **Answers questions** in natural language — "How many patients had a fall risk score above 3 in Q2 2024?"

The user sees everything the AI is doing in real-time via streamed tool steps, and approves or rejects destructive operations before they execute.

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
│  │ /ingest     → Parse + Profile (Native TS)                   │ │
│  │ /chat       → AI Agent (Streaming SSE)                      │ │
│  │ /pipeline   → Agent-driven tool execution                   │ │
│  │ /projects   → CRUD + Pipeline state + Semantic layer        │ │
│  │ /dashboard  → Pinned widgets + Quality alerts               │ │
│  │ /harmonize  → Trigger harmonization (SSE)                   │ │
│                                                                  │
│  AI Agent (ToolLoopAgent) ──────────────────────────────────── │
│  │ 13 tools across 4 execution tiers:                          │ │
│  │                                                              │ │
│  │ Native TS:  parse_file, profile_columns, run_quality_check  │ │
│  │ LLM:        suggest_cleaning, propose_mappings,             │ │
│  │             explain_lineage, generate_artifact              │ │
│  │ E2B:        execute_cleaning, run_harmonization,            │ │
│  │             run_query, run_script                           │ │
│  │ Supabase:   confirm_mappings, update_semantic               │ │
│                                                                  │
│  Services ─────────────────────────────────────────────────────│
│  │ profiler.ts   → Column stats + LLM semantic enrichment     │ │
│  │ cleaner.ts    → Pandas script generation + E2B execution   │ │
│  │ mapper.ts     → LLM-driven column mapping proposals        │ │
│  │ harmonizer.ts → Pandas transforms → Parquet in E2B         │ │
│  │ query.ts      → DuckDB SQL on Parquet in E2B               │ │
│  │ sandbox.ts    → E2B lifecycle, signed URLs, safety          │ │
│  │ semantic.ts   → Semantic layer assembly for agent context   │ │
│  │ storage.ts    → Supabase Storage wrapper                   │ │
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
│              │   │  ├ mappings      │   │  ├ PyArrow             │
│              │   │  ├ pipeline      │   │                      │
│              │   │  ├ semantic      │   │  Isolated per-request │
│              │   │  ├ conversations │   │  30s timeout          │
│              │   │  └ alerts        │   │  1000 row cap         │
│              │   │                  │   │                      │
│              │   │  Storage:        │   │  Loads files via      │
│              │   │  ├ raw/ (CSV)    │   │  signed URLs from     │
│              │   │  ├ cleaned/      │   │  Supabase Storage     │
│              │   │  └ harmonized/   │   │                      │
│              │   │    (Parquet)     │   │                      │
└─────────────┘   └─────────────────┘   └──────────────────────┘
```

### Key Design Decisions

| Decision | Why |
|---|---|
| **Metadata vs Data separation** | Postgres stores only structure (profiles, mappings, pipeline state). Actual data rows never enter the database — they live as files in object storage. |
| **E2B sandboxes for data ops** | All data manipulation (cleaning, harmonization, querying) runs in isolated Python sandboxes. The backend never loads patient data into its own process. |
| **Parquet as interchange format** | Columnar format with type preservation. DuckDB can query it directly without importing. |
| **Human-in-the-loop** | Safe operations (profiling, querying) run automatically. Destructive operations (cleaning, mapping confirmation, harmonization) pause and ask for user approval. |
| **Multi-stage querying** | The AI agent can query data at any stage — raw CSV, cleaned Parquet, or harmonized Parquet — depending on how far the pipeline has progressed. |

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
              │  Column stats (nulls,  │
              │  uniques, types)       │
              │         +              │
              │  LLM semantic labels   │  ← GPT-5.2-codex
              │  ("FallID" → Case ID)  │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  2. CLEAN               │
              │                        │
              │  AI proposes plan:     │  ← LLM suggests
              │  - Parse dates         │
              │  - Normalize IDs       │
              │  - Fill nulls          │
              │                        │
              │  User approves ✓       │  ← Human-in-the-loop
              │                        │
              │  pandas executes in    │  ← E2B Sandbox
              │  isolated sandbox      │
              │  → Cleaned Parquet     │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  3. MAP                 │
              │                        │
              │  AI reads all source   │  ← LLM proposes
              │  profiles and proposes │
              │  source → target       │
              │  column mappings with  │
              │  confidence scores     │
              │                        │
              │  User reviews in       │  ← Target-centric UI
              │  mapping panel,        │
              │  accepts / rejects     │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  4. HARMONIZE           │
              │                        │
              │  Deterministic:        │  ← E2B Sandbox
              │  - Column renames      │
              │  - Type casts          │
              │  - Joins on shared IDs │
              │  → Parquet per target  │
              │    table               │
              │                        │
              │  Semantic layer        │  ← Supabase metadata
              │  updated (tables,      │
              │  fields, joins)        │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  5. QUERY               │
              │                        │
              │  "How many patients    │
              │   had fall risk > 3?"  │
              │                        │
              │  AI writes DuckDB SQL  │  ← LLM generates
              │  → Runs on Parquet     │  ← E2B Sandbox
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
| Storage | Supabase Storage (raw CSV, cleaned/harmonized Parquet) |
| Validation | Zod 3 |
| File parsing | PapaParse, xlsx |

### Infrastructure

| Service | Purpose |
|---|---|
| Supabase | Postgres + Storage + Auth (future) |
| E2B | Isolated Python sandboxes for data ops |
| OpenAI | GPT-5.2-codex for code generation + reasoning |
| Vercel | Frontend hosting |

---

## Project Structure

```
CareMap/
├── apps/
│   ├── api/                        # Fastify backend
│   │   ├── src/
│   │   │   ├── config/             # AI, env, Supabase clients
│   │   │   ├── lib/                # Error classes, types
│   │   │   ├── routes/             # HTTP endpoints
│   │   │   │   ├── chat.ts         # AI agent streaming
│   │   │   │   ├── ingest.ts       # File upload + profiling
│   │   │   │   ├── pipeline.ts     # Agent-driven pipeline ops
│   │   │   │   ├── projects.ts     # Project CRUD
│   │   │   │   └── ...
│   │   │   ├── services/           # Business logic
│   │   │   │   ├── agent.ts        # ToolLoopAgent + system prompt
│   │   │   │   ├── sandbox.ts      # E2B wrapper + safety
│   │   │   │   ├── profiler.ts     # Parse + profile
│   │   │   │   ├── cleaner.ts      # Cleaning script gen + exec
│   │   │   │   ├── harmonizer.ts   # Harmonization orchestration
│   │   │   │   ├── query.ts        # Multi-stage DuckDB queries
│   │   │   │   └── tools/          # 13 AI SDK tool definitions
│   │   │   └── server.ts           # Fastify entry point
│   │   ├── supabase/migrations/    # SQL schema
│   │   ├── e2b/Dockerfile          # Custom sandbox image
│   │   └── .env.example
│   │
│   └── web/                        # Vite + React frontend
│       └── src/
│           ├── components/
│           │   ├── canvas/         # ReactFlow nodes, edges, inspector
│           │   ├── agent/          # Chat UI, tool steps, artifacts
│           │   ├── dashboard/      # Widgets, alerts
│           │   └── ui/             # shadcn primitives
│           ├── lib/                # Stores, mock data, utils
│           └── pages/              # Route pages
│
├── data/                           # Sample clinical datasets
│   └── split_data_pat_case_altered/  # 4 clinics × 7 file types
│
└── docs/                           # Architecture + design specs
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
git clone https://github.com/hookcpt/CareMap.git
cd CareMap

# Install dependencies (npm workspaces)
npm install

# Configure backend environment
cp apps/api/.env.example apps/api/.env
# Fill in your keys — see "Environment Variables" below

# Run database migrations
# (Use Supabase dashboard or CLI to run apps/api/supabase/migrations/001_initial_schema.sql)

# Start backend
npm run dev -w api        # → http://localhost:3001

# Start frontend (separate terminal)
npm run dev -w web        # → http://localhost:5173
```

### Environment Variables

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase dashboard → Settings → API → Service Role Key |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `E2B_API_KEY` | [e2b.dev/dashboard](https://e2b.dev/dashboard) |

---

## API Overview

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/api/projects` | GET, POST | List / create projects |
| `/api/projects/:id` | PATCH | Update project settings |
| `/api/projects/:id/pipeline` | GET, PUT | Load / save canvas state |
| `/api/projects/:id/semantic` | GET | Semantic layer context |
| `/api/projects/:id/conversations` | GET, POST | Conversation history |
| `/api/ingest` | POST | Upload file + stream profiling (SSE) |
| `/api/chat` | POST | AI agent conversation (SSE) |
| `/api/projects/:id/pipeline/trigger` | POST | Trigger agent-driven pipeline ops (SSE) |
| `/api/dashboard` | GET | Dashboard data (widgets, alerts, sources) |
| `/api/dashboard/artifacts/pin` | POST | Pin chart artifact from chat |
| `/api/harmonize` | POST | Trigger harmonization (SSE) |

---

## AI Agent Tools

The agent has 13 tools organized by execution tier:

| Tool | Tier | Needs Approval | Description |
|---|---|---|---|
| `parse_file` | Native TS | No | Parse uploaded CSV/XLSX |
| `profile_columns` | Native TS | No | Compute column statistics + semantic labels |
| `run_quality_check` | Native TS | No | Check data quality issues |
| `suggest_cleaning` | LLM | No | Propose cleaning plan (fixed function library) |
| `propose_mappings` | LLM | No | Propose source → target column mappings |
| `explain_lineage` | LLM | No | Explain data lineage and transformations |
| `generate_artifact` | LLM | No | Generate chart specification from query results |
| `execute_cleaning` | E2B | **Yes** | Run pandas cleaning in sandbox |
| `run_harmonization` | E2B | **Yes** | Run harmonization, write Parquet |
| `run_query` | E2B | No | Execute DuckDB SQL on Parquet |
| `run_script` | E2B | **Yes** | Run arbitrary Python script |
| `confirm_mappings` | Supabase | No | Persist accepted/rejected mappings |
| `update_semantic` | Supabase | No | Update semantic layer metadata |

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

## License

MIT
