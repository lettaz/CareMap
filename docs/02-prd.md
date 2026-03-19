# CareMap — Product Requirements Document

**Version:** 1.0 · March 2026
**Scope:** START Hack 2026 (36-hour hackathon prototype)
**Challenge:** epaSOLUTIONS — Smart Health Data Mapping

---

## 1. Executive Summary

CareMap is an AI-native healthcare data harmonization platform. Users build visual data pipelines by dragging source nodes onto a canvas. The system AI-profiles each source on arrival, maps it to a unified clinical model, and exposes a chat-driven analyst that generates live visualisations pinnable to a dashboard. The prototype demonstrates the full loop from raw file upload to actionable clinical insight.

---

## 2. Problem Statement

Healthcare data across epaSOLUTIONS' 1,400 partner institutions exists in dozens of disconnected formats. Combining this data for analytics, quality monitoring, or predictive modelling currently requires weeks of manual data engineering per institution. There is no unified tool that ingests heterogeneous clinical sources, harmonizes them with AI assistance, and makes the result queryable by non-technical users — while keeping full explainability and data lineage.

---

## 3. Goals and Non-Goals

### Goals

- Demonstrate end-to-end data harmonization from file upload to natural-language query in under 5 minutes.
- Show that AI can accurately profile clinical data sources and propose meaningful mappings with human-in-the-loop correction.
- Provide a visual, node-based pipeline interface that makes data flow transparent and auditable.
- Enable conversational analytics over harmonized data with full provenance.
- Demonstrate a credible on-premise deployment path through model-switching settings.

### Non-Goals

- Production-grade security, authentication, or role-based access control.
- Live connectors to hospital information systems or HL7/FHIR endpoints.
- Full FHIR or OMOP canonical model compliance.
- Multi-tenancy or cross-institutional data sharing.
- Mobile or tablet-optimised interfaces.

---

## 4. Success Metrics

| Metric | Target |
|---|---|
| Time from file upload to first chart | Under 5 minutes |
| AI mapping suggestion acceptance rate | Over 80% accepted without manual edit |
| Chat query response time | Under 8 seconds for simple queries |
| Canvas performance | Smooth interaction with up to 20 nodes |
| Dashboard requirement coverage | All 5 epaSOLUTIONS requirements addressed (origin, quality, anomalies, alerts, corrections) |

---

## 5. Personas

### Data Steward (Petra)

Clinical data engineer responsible for connecting sources and maintaining pipeline quality. Primary user of the flow canvas, node configuration panels, and mapping review interface. Needs to see every AI decision explained with confidence scores and sample data.

### Clinical Analyst (Daniel)

Quality manager who consumes dashboards, investigates anomalies, and asks natural-language questions. Doesn't write SQL. Needs clear visualisations, explainable query results, and easy drill-through to underlying records.

### IT Administrator (Markus)

Manages deployment and model configuration. Needs the settings interface to demonstrate the on-premise path. Not a daily user of the data pipeline.

---

## 6. Assumptions

| Assumption | Status | Risk if Wrong |
|---|---|---|
| Provided data is in CSV/Excel format with German column names | To validate | Need to adapt parser and prompts for the actual format |
| epaSOLUTIONS does not require a specific canonical data model | To validate | Would need to remap our schema to match theirs |
| Cloud LLM API access is available during the hackathon | To validate | Need to pre-cache responses or use local model |
| Supabase (Postgres) is acceptable as the demo database | To validate | May need to switch to the database they prefer |
| Judges want a working prototype, not just slides | Validated (case brief says "clickable prototype or mockup") | — |

---

## 7. Scope

### Must Have (P0) — Demo Blockers

**F1. Visual Flow Canvas**
A ReactFlow-based canvas where users drag source nodes, mapping nodes, quality check nodes, and store nodes. Nodes connect via edges to form a visual pipeline. Each node displays a status badge and basic stats. The canvas supports pan, zoom, and node selection with a right-side inspector panel.

**F2. Source Node with AI Profiling**
Four source node types: CSV, Excel, PDF, Text. Each provides a file upload zone in its configuration panel. On file drop, the system parses the file and streams an AI analysis that infers column types, semantic labels, clinical domain classification, and quality issues. Results display in the node's config panel as an interactive table where users can correct any inference.

**F3. Mapping Node with AI Suggestions**
When source nodes connect to a mapping node, the system generates mapping suggestions: source field → target canonical field, with confidence score and reasoning. When multiple sources connect to one mapper, the AI builds a unified semantic model across all sources. Users review and accept/reject/edit mappings in the node config panel. Confirmed mappings trigger harmonization to the canonical store.

**F4. Dynamic Semantic Layer**
The semantic layer is generated on the fly from user uploads and confirmed mappings. It is stored in Supabase as structured metadata (source profiles, semantic entities, field definitions, join relationships). At query time, this metadata is hydrated into YAML files in the agent's sandbox environment, enabling the analyst agent to explore it with shell commands following the Vercel OSS Data Analyst pattern.

**F5. Chat Panel with Data Analyst Agent**
A persistent chat interface powered by Vercel AI SDK `useChat`. The analyst agent has tools to read the semantic layer (from sandbox), execute SQL against Supabase, generate chart specifications, run quality checks, and explain lineage. Responses stream in real time and include text, inline charts, collapsible query plans, and lineage references.

**F6. Pin-to-Dashboard**
Any chart generated in the chat can be pinned to a persistent dashboard tab. Pinned widgets display the chart, its title, the query that generated it, and a refresh button. The dashboard also includes built-in quality widgets: source overview, completeness heatmap, and anomaly alert feed.

**F7. Settings — Model Switching**
A settings page with a model selector dropdown (cloud models) and a custom endpoint configuration (base URL, API key, model name, test connection). Demonstrates the on-premise deployment path without requiring actual local model hosting.

### Should Have (P1) — Differentiators

**F8. PDF / Free-Text Intelligence**
The PDF and Text source nodes use LLM vision or extraction to identify clinical entities (patient IDs, scores, dates, diagnoses) in unstructured content. Extracted fields appear in the node config panel alongside structured sources and flow into the same mapping pipeline.

**F9. Anomaly Drill-Through**
From any alert in the anomaly feed, click to see a filtered table of affected records with anomalous values highlighted. Option to open in chat for investigation.

**F10. Lineage Visualisation**
Click any harmonized field in the dashboard or chat results to see a mini graph tracing its path from source file through mapping and transformation to the canonical table.

### Could Have (P2) — Polish

**F11. Pipeline Templates** — Pre-built pipeline configurations users can load onto the canvas.

**F12. Export** — Download harmonized data as CSV or dashboard as PNG.

**F13. Real-time Node Status** — Supabase Realtime subscriptions to update node record counts as data flows through the pipeline.

---

## 8. Functional Requirements

### FR-1: File Upload and Parsing

The system must accept CSV, XLSX, PDF, and TXT files via drag-and-drop onto source nodes. Files must be parsed within 3 seconds (for structured formats). The parsed output must include: raw data (array of rows), detected column names, row count, and file metadata.

**Acceptance criteria:**
- User drops a CSV onto a CSV source node → file is parsed and row count appears on the node within 3 seconds.
- User drops an XLSX with multiple sheets → system parses the first sheet by default, with option to select others.
- User drops a PDF → system attempts text extraction; if content is tabular, it is parsed into rows and columns.

### FR-2: AI Schema Profiling

On file parse completion, the system must call the LLM with column names, sample data (first 5–10 rows), and the canonical model definition. The response must include: inferred type per column, semantic label, clinical domain classification, confidence score, and detected quality issues. The response must stream progressively.

**Acceptance criteria:**
- Within 5 seconds of file parse, the node config panel begins populating with profiling results.
- Each column shows: name, inferred type, semantic label, confidence (colour-coded), sample values.
- User can click any field to edit the inferred type or semantic label via dropdown.

### FR-3: Mapping Suggestion Generation

When one or more source nodes are connected to a mapping node, the system must generate mapping suggestions. Each suggestion maps a source column to a canonical target table and column, with confidence, reasoning, and transformation notes (e.g., "scale normalization needed: 0-10 → 0-4"). When multiple sources connect, the system must detect overlapping entities and propose a merged semantic model.

**Acceptance criteria:**
- Source → Mapper edge created → mapping suggestions appear within 8 seconds.
- Each suggestion row shows: source reference, target reference, confidence bar, sample values, action buttons.
- User can accept, reject, or edit each mapping individually or in bulk.

### FR-4: Data Harmonization

When mappings are confirmed, the system must transform source data according to the mapping rules and write it to the canonical Supabase tables. Transformations include: column renaming, type casting, unit conversion (where specified), and code translation. The system must record provenance metadata for every row written.

**Acceptance criteria:**
- User clicks "Harmonize" → data is written to canonical tables → node shows "247 rows harmonized" status.
- Each row in the canonical table has a `source_file_id` linking back to its origin.
- Field mappings are recorded in the `field_mappings` table with status, confidence, and reviewer.

### FR-5: Semantic Layer Generation

The system must maintain a semantic layer that describes all harmonized data. This layer is stored in Supabase as structured metadata and hydrated into YAML files in a sandbox at query time. It must include: entity definitions, field descriptions, data types, join relationships, and example questions. The layer must update automatically when new mappings are confirmed.

**Acceptance criteria:**
- After harmonization, the semantic layer includes the newly mapped entities.
- The analyst agent can discover and query the new data immediately.
- The YAML hydration produces valid entity files that the agent can explore with `cat` and `grep`.

### FR-6: Conversational Query

The chat panel must accept natural-language questions and return answers using the analyst agent's tool loop. The agent must: read the semantic layer, build SQL, execute it against Supabase, and return results as text, charts, or tables. Each response must include an expandable query plan showing the SQL and tables used.

**Acceptance criteria:**
- User types "What is the average fall risk score by ward?" → chart renders within 8 seconds.
- Response includes narrative text + chart + collapsible query plan.
- Query plan shows: SQL query, tables used, join conditions, data freshness timestamp.

### FR-7: Dashboard with Pinned Widgets

The dashboard tab must display built-in quality widgets and user-pinned chart widgets. Built-in widgets: source overview (record counts per source), completeness heatmap (per-field fill rates), anomaly alert feed. Pinned widgets are saved to Supabase and persist across sessions.

**Acceptance criteria:**
- User clicks "Pin" on a chat chart → it appears on the dashboard within 2 seconds.
- Built-in quality widgets are always visible and update when new data is harmonized.
- Each pinned widget has a "Refresh" button that re-runs its query.

---

## 9. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Initial page load | Under 3 seconds |
| Canvas frame rate (20 nodes) | 60 fps pan/zoom |
| LLM streaming latency (first token) | Under 2 seconds |
| File parse time (1,000-row CSV) | Under 1 second |
| Concurrent users | 1 (prototype) |
| Browser support | Chrome latest (demo machine) |
| Accessibility | Basic keyboard navigation, sufficient colour contrast |
| Language | English UI, German data support (column names, values) |

---

## 10. Data Requirements

### Input Data (from epaSOLUTIONS)

Anonymized real-world healthcare data complemented by synthetic datasets:
- Care assessments and scores (mobility, fall risk, nutrition)
- Care interventions
- Medical data (diagnoses, procedures)
- Laboratory parameters
- Sensor data and vital signs
- Medication plans
- Staff scheduling and resource planning data

### Canonical Model

A simplified relational model covering: patients, encounters, diagnoses, lab results, vital signs, medications, care assessments, care interventions, sensor readings, and staff schedules. Plus metadata tables for source files, field mappings, pipeline state, pinned widgets, and quality alerts.

---

## 11. Integration Points

| System | Type | Purpose |
|---|---|---|
| Supabase | Database | Canonical data store, semantic metadata, pipeline state, realtime subscriptions |
| Vercel AI SDK | Framework | Agent tool execution, streaming, `useChat` frontend integration |
| Vercel AI Gateway | LLM routing | Model selection, cost tracking, failover |
| Vercel Sandbox | Execution environment | Semantic layer hydration, agent shell exploration, SQL execution |
| ReactFlow | UI library | Visual flow canvas |
| Recharts | UI library | Chart rendering in chat and dashboard |

---

## 12. Risks and Dependencies

| Risk | Impact | Mitigation |
|---|---|---|
| Provided data format doesn't match expectations | High | Explore data in hour 1; adapt schema and prompts before building |
| LLM API latency makes demo slow | High | Pre-cache profiling and mapping results for demo datasets; show one live call |
| ReactFlow + streaming AI integration is complex | High | Dedicate one person entirely to the canvas; use built-in ReactFlow examples |
| Sandbox hydration adds latency to chat | Medium | Keep semantic layer small; hydrate once per conversation, not per message |
| Supabase free tier limits | Low | Well within limits for a prototype with demo data |

---

## 13. Out of Scope

- User authentication and role-based access control
- Live database or HL7/FHIR connectors
- Real-time streaming ingestion from hospital systems
- Multi-language UI (English only; German data support only)
- Production deployment, scaling, or performance optimization
- HIPAA/GDPR compliance certification (designed for compatibility, not certified)
- Automated testing or CI/CD pipeline
- Mobile or responsive layout beyond desktop
