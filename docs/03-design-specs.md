# CareMap — UI/UX Design Specifications

**Version:** 2.0 · March 2026

---

## 1. Design Philosophy

CareMap is a data engineering tool used in clinical contexts. The design must balance two competing demands: the technical density required by data stewards building pipelines, and the clarity required by clinical analysts consuming insights.

### Governing Principles

**Clinical trust through transparency.** Every AI decision — mapping suggestions, query results, anomaly flags — must show its source, confidence, and reasoning. Nothing is a black box. Healthcare users will not adopt a tool they cannot verify.

**Progressive disclosure.** Surfaces are simple by default. The canvas shows nodes and connections. The chat shows answers. Complexity (SQL queries, lineage graphs, transformation rules) is one click away but never forced on the user.

**Spatial thinking over sequential menus.** The node-based canvas lets users see the entire data pipeline at once, not navigate through a sequence of screens. Following the broader industry shift from apps to spatial workflows, CareMap treats the canvas as the primary workspace and everything else as contextual panels.

**Role-appropriate density.** Petra (data steward) sees detailed node configurations and mapping tables. Daniel (clinical analyst) sees dashboards and chat results. Same data, different levels of detail, controlled by which surface they're using.

**Agents as collaborative partners.** Inspired by Pigment's agentic UX and Zeit AI's natural-language-first approach, CareMap treats AI agents as visible, named collaborators — not hidden backend processes. Users choose which agent to engage, see its plan before execution, and always retain approval authority. This follows the industry shift toward "intent-based" interaction: describe what you want, review the plan, then execute.

**Calm, light, and professional.** Enterprise healthcare users work in well-lit clinical and office environments. A light theme with restrained colour, high-contrast typography, and generous whitespace communicates professionalism and trustworthiness. Information density is achieved through typographic hierarchy and structured layouts — not through darkening the interface. This aligns with the modern enterprise SaaS standard (Linear, Notion, Figma, Pigment) of clean light foundations with deliberate, semantic colour accents.

---

## 2. Layout Architecture

### Global Shell

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  CareMap    [🔍 Cmd+K]            [⚙ Settings]  [👤] │
├────┬────────────────────────────────────────────────────────┤
│    │                                                        │
│ N  │              CONTENT AREA                              │
│ A  │   (Canvas / Dashboard / Settings)                      │
│ V  │                                                        │
│    │                                            ┌─────────┐ │
│ [] │                                            │  AGENT  │ │
│ [] │                                            │  PANEL  │ │
│ [] │                                            │         │ │
│    │                                            └─────────┘ │
└────┴────────────────────────────────────────────────────────┘
```

**Top bar:** White background with a subtle bottom border (`border-primary`). Logo, product name in `text-primary` weight 600, global search (Cmd+K), settings gear, user avatar. Minimal, stays out of the way.

**Left navigation:** Icon-only sidebar, `bg-surface` background with a right border. Always visible. Three items: Canvas (nodes icon), Dashboard (grid icon), Settings (gear icon). Active item highlighted with `accent` colour and a left indicator bar. Expands to icon+label on hover with `bg-hover` background.

**Content area:** `bg-app` background. Fills the remaining space. Each view (Canvas, Dashboard, Settings) owns its own internal layout.

**Agent panel:** Persistent right sidebar, collapsible. Width: 420px expanded, 48px collapsed (showing only the agent icon). Toggles with a keyboard shortcut or click. Slides over the content area, does not push it. This panel replaces the previous "chat panel" with a richer agent-first experience (see Section 4).

### Responsive Approach

The hackathon prototype targets desktop only (1440px+). The layout is fixed, not responsive. The canvas requires mouse interaction (pan, zoom, drag-and-drop) that doesn't translate to touch. If time allows, the dashboard and chat can use basic responsive column stacking.

---

## 3. The Canvas View

### Layout

Full-bleed ReactFlow canvas with two contextual panels. The canvas uses a subtle dot-grid background pattern on `bg-app` to provide spatial orientation during pan and zoom.

| Zone | Position | Content |
|---|---|---|
| Node palette | Left drawer (overlays canvas), triggered by "+" button | Categorised draggable nodes: Sources, Transforms, Quality, Sinks |
| Canvas | Centre, fills all available space | Interactive node graph with pan, zoom, minimap |
| Inspector | Right panel, 360px, appears on node selection | Node configuration, profiling results, mapping suggestions |

### Node Palette

Triggered by a floating "+" button at top-left of the canvas. Button has `bg-surface` background, `border-primary` border, and an `accent` icon. Opens a narrow drawer listing available node types, grouped by category with section headers. Each item shows an icon, name, and one-line description. User drags an item from the palette onto the canvas to create a node. Palette closes automatically after a drop.

Categories and their visual colour:

| Category | Colour | Nodes |
|---|---|---|
| Sources (blue) | `#3B82F6` | CSV Source, Excel Source, PDF Source, Text Source |
| Transforms (emerald) | `#059669` | Mapping |
| Quality (amber) | `#D97706` | Quality Check |
| Sinks (indigo) | `#6366F1` | Harmonized Store |

### Node Visual Design

Each node is a rounded-rectangle card, minimum 180px wide × 80px tall. White `bg-surface` background with `border-primary` border and a 3px left border in the category colour. Subtle `elevation-surface` shadow.

**Anatomy:**

```
┌─── category colour border
│ ┌────────────────────────────┐
│ │  [icon] Node Label    [●]  │  ← status dot (green/amber/red/grey)
│ │  247 rows · 12 fields      │  ← subtitle stats in text-secondary
│ └────────────────────────────┘
    ○ input port          output port ○
```

- **Header:** Category icon + user-editable label in `text-primary` weight 600 (defaults to detected domain, e.g., "Care Assessments"). Status dot at far right.
- **Subtitle:** Key stats in `text-secondary`, updated after profiling ("247 rows · 12 fields") or harmonization ("247 rows written").
- **Ports:** Small circles on left (input) and right (output) edges. Port fill: `bg-elevated`, border: `border-primary`. On hover: fill transitions to category colour with white inner dot.
- **Status dot:** `text-tertiary` (not run), `success` (OK), `warning` (warnings), `error` (errors).

**Selected state:** `accent` border replaces default border, `ring-accent` focus ring, inspector panel opens on the right.

**Running state:** Subtle pulse animation on the status dot.

### Edge Design

- Default: Curved bezier, 2px, `#CBD5E1` (slate-300 — visible on light canvas).
- Active/data-flowing: Animated dash pattern along the edge, `accent` colour.
- Error: Solid `error` colour with a subtle pulse.

### Inspector Panel

Opens when a node is selected. 360px wide, `bg-surface` background with `border-primary` left border. Fixed to the right side of the canvas area (not the agent panel — inspector and agent coexist if screen width allows, otherwise inspector pushes agent closed).

**Tabs (per node type):**

For source nodes:
- **Upload** — Drop zone for file upload (when no file loaded) or file info card (when loaded).
- **Profile** — AI-inferred schema table: column name, type, semantic label, confidence bar, sample values. Each row is editable via dropdowns.
- **Quality** — Summary of detected issues: null rates, outliers, format problems.

For mapping nodes:
- **Mappings** — Table of mapping suggestions with accept/reject/edit actions. Includes an "Agent Plan" banner at top showing the Builder Agent's proposed mapping strategy before individual suggestions. When multiple sources are connected, this shows the unified semantic model proposal.
- **Confirmed** — List of accepted mappings with transformation details.

For quality check nodes:
- **Results** — Quality metrics: completeness percentages, range check results, detected anomalies.

For harmonized store nodes:
- **Status** — Write status, record counts, last harmonization timestamp.
- **Schema** — View of the canonical tables this pipeline writes to.

---

## 4. The Agent Panel

### Design Rationale

Inspired by Pigment AI's multi-agent sidebar and Zeit AI's natural-language-first philosophy, CareMap replaces the simple chat panel with a purpose-built agent panel. Instead of a generic chat interface, users explicitly choose an agent, see its structured workflow, and retain approval authority at every step.

### Layout

Right sidebar, 420px wide when expanded. Collapsible to a 48px strip showing only the agent icon. `bg-surface` background with a `border-primary` left border.

**Anatomy:**

```
┌──────────────────────────────┐
│  CareMap Agents         [—]  │  ← header with collapse button
├──────────────────────────────┤
│                              │
│  ┌────────┐  ┌────────┐     │  ← agent selector tiles
│  │ 🔧     │  │ 📊     │     │
│  │Builder │  │Analyst │     │
│  │ Agent  │  │ Agent  │     │
│  └────────┘  └────────┘     │
│                              │
├──────────────────────────────┤
│                              │
│  Agent workflow area         │  ← scrollable, changes per agent
│  (thread + structured        │
│   workflow steps)            │
│                              │
│  ┌────────────────────────┐  │
│  │ [chart / plan / result │  │  ← inline outputs
│  │  rendered inline]  📌  │  │
│  └────────────────────────┘  │
│                              │
│  ▸ Execution Details         │  ← collapsible provenance
│    SQL / lineage / steps     │
│                              │
├──────────────────────────────┤
│  [Describe what you need..]→ │  ← input area
│  Suggested: [chip][chip]     │  ← context-aware prompt chips
└──────────────────────────────┘
```

### Agent Selector

Two tiles at the top of the panel, always visible when no conversation is active. Each tile is a card with `bg-app` background, `border-primary` border, and a hover state of `bg-hover`.

**Builder Agent Tile:**
- Icon: wrench/hammer icon in `#059669` (emerald)
- Label: "Builder Agent"
- Subtitle: "Profile sources, map fields, build your data model"
- Active state: emerald left border accent, `bg-hover` background

**Analyst Agent Tile:**
- Icon: chart/magnifying glass icon in `#3B82F6` (blue)
- Label: "Analyst Agent"
- Subtitle: "Query data, generate charts, investigate anomalies"
- Active state: blue left border accent, `bg-hover` background

Once an agent is selected, the tiles collapse into a compact header showing the active agent's icon and name, with a "Switch agent" dropdown.

### Builder Agent Workflow (Pigment Modeler Pattern)

The Builder Agent follows a structured **Intent → Plan → Build → Iterate** workflow, visible in the panel.

**Step indicators:** A horizontal stepper bar appears below the agent header showing the four phases. The current phase is highlighted in `accent` colour, completed phases show a checkmark, and future phases are in `text-tertiary`.

```
  ● Intent  ─── ○ Plan  ─── ○ Build  ─── ○ Iterate
  (active)
```

**Intent phase:** User describes what they need in natural language. Example: "I just uploaded a care assessment file with German column names. Help me profile it and map it to the canonical model." The agent confirms understanding and moves to Plan.

**Plan phase:** The agent presents a structured plan card:

```
┌──────────────────────────────────┐
│  📋 Proposed Plan                │
│                                  │
│  1. Profile 12 columns from      │
│     care_assessments.csv         │
│  2. Classify domain as care      │
│     assessments (high confidence)│
│  3. Map 10 fields to canonical   │
│     model (2 need review)        │
│  4. Run quality check on         │
│     mapped data                  │
│                                  │
│  [Approve & Execute]  [Edit Plan]│
└──────────────────────────────────┘
```

The user reviews and approves or edits before the agent proceeds.

**Build phase:** The agent executes the approved plan. Progress is shown step by step with status indicators. Results stream into the inspector panel (profiling results, mapping suggestions). The chat thread shows a running summary.

**Iterate phase:** After execution, the agent summarises results and asks if corrections are needed. The user can request changes in natural language: "The 'Station' column should map to encounters.ward, not patients.external_id." The agent proposes an updated plan and re-executes.

### Analyst Agent Workflow (Pigment Analyst Pattern)

The Analyst Agent follows a structured **Mission → Scan → Analysis → Report → Outcome** workflow.

**Step indicators:** Same horizontal stepper pattern.

```
  ● Mission  ─── ○ Scan  ─── ○ Analysis  ─── ○ Report  ─── ○ Outcome
  (active)
```

**Mission phase:** User describes their analytical goal. Example: "What is the average fall risk score by ward for the last 30 days?" The agent confirms the mission scope.

**Scan phase:** The agent shows which data sources and entities it will query. Displayed as a compact card listing tables, fields, and join paths. The user can verify scope before the agent proceeds.

**Analysis phase:** The agent builds and executes SQL. A "thinking" indicator shows progress. The execution details (SQL query, tables used) stream into a collapsible section.

**Report phase:** Results render as text narrative + inline visualisation (charts, tables). Each chart has a "Pin to Dashboard" button. The query plan is shown in a collapsible block below.

**Outcome phase:** The agent summarises key findings and suggests follow-up questions as chips. Pinned charts persist to the dashboard. The mission can be saved for repeat execution (future scope).

### Response Types

**Text:** Narrative explanation paragraph. Left-aligned with agent avatar (coloured icon matching the active agent).

**Chart:** Rendered inline using Recharts. Chart types: bar, line, pie, heatmap, table. Each chart has a "Pin to Dashboard" button in its top-right corner. Charts use the semantic colour palette for data series.

**Plan Card:** Structured proposal with numbered steps, a summary, and Approve/Edit action buttons. `bg-app` background with `border-primary` border and a left accent stripe matching the agent colour.

**Execution Details:** Collapsible block below outputs. Shows: the SQL query, tables used, join conditions, data freshness note ("Data from: care_assessments, last sync 8 min ago"), and lineage references.

**Lineage Note:** Small metadata line linking the answer to its source data.

### Input Area

Text input with `bg-app` background, `border-primary` border, and `text-primary` text. Placeholder text changes based on active agent:
- Builder: "Describe what you want to profile, map, or build..."
- Analyst: "Ask a question about your data..."

When the input is empty, suggested prompt chips appear above it. These are context-aware: if the user just harmonized care assessment data, suggestions might include "Show average fall risk by ward" or "Which fields have the most missing data?"

---

## 5. The Dashboard View

### Layout

`bg-app` background. Grid layout, maximum 3 columns. Built-in widgets at the top, pinned widgets below. Section headers in `text-primary` weight 600.

### Built-in Widgets (Always Visible)

Each widget is a card with `bg-surface` background, `border-primary` border, `elevation-surface` shadow, and `radius-card` corners.

**Source Overview Card**
Lists all connected sources with: status dot, filename, record count, mapped/unmapped field counts, last sync time. Compact table layout with alternating `bg-app` / `bg-surface` row backgrounds.

**Completeness Heatmap**
Rows = harmonized fields (top 15 by importance). Columns = wards or time buckets. Cell colour = fill rate gradient. Green (`success` → `#D1FAE5`) for >95%, amber (`warning` → `#FEF3C7`) for 80-95%, red (`error` → `#FEE2E2`) for <80%. Hover to see exact percentage in a tooltip.

**Anomaly Alert Feed**
Chronological list of detected issues. Each alert shows: severity icon (critical `error`, warning `warning`, info `accent`), one-line summary in `text-primary`, affected record count in `text-secondary`, timestamp. Click to see affected records. Unacknowledged alerts have a subtle `bg-app` left border accent in their severity colour.

### Pinned Widgets

Each pinned widget is a card with `bg-surface` background showing:
- Title (user-editable or auto-generated from the query) in `text-primary` weight 600
- The chart (bar, line, heatmap, table)
- "Last refreshed: X min ago" timestamp in `text-tertiary`
- Refresh button (re-runs the original query)
- Remove button (unpins)

Clicking a pinned widget opens the agent panel with the Analyst Agent pre-selected and the original query pre-loaded, allowing the user to explore further.

### Widget Sizing

Built-in widgets span the full width. Pinned widgets are arranged in a 2-column or 3-column masonry grid depending on chart type. Bar and line charts default to 2-column width. Tables default to full width.

---

## 6. The Settings View

### Layout

`bg-app` background. Simple form layout, single column, max-width 640px centred. Section cards use `bg-surface` background with `border-primary` border.

### Sections

**Model Configuration**
- Dropdown: Model selector (`openai/gpt-4.1`, `openai/gpt-5.4-mini`, `anthropic/claude-sonnet`, `Custom`)
- When "Custom" selected, additional fields appear:
  - API Base URL (text input, placeholder: `http://localhost:11434/v1`)
  - API Key (password input, optional)
  - Model Name (text input, placeholder: `llama3`)
- "Test Connection" button that sends a simple prompt and shows: success/failure, latency, model response preview.

**Mapping Thresholds**
- Slider: Auto-accept confidence threshold (default: 85%). Mappings above this are accepted automatically.
- Slider: Review threshold (default: 60%). Mappings below this are flagged as uncertain.

**Data**
- "Clear all data" button with confirmation dialog. Resets the demo.

---

## 7. Design Tokens

### Colour System

CareMap uses a light theme as primary. Light interfaces are the standard for modern enterprise SaaS (Linear, Notion, Figma, Pigment) and align with clinical office environments where screens are viewed under overhead lighting. A professional light foundation allows semantic colours (confidence indicators, alerts, status) to stand out with maximum clarity.

**Backgrounds:**

| Token | Value | Usage |
|---|---|---|
| `bg-app` | `#F8FAFC` | Application background (slate-50) |
| `bg-surface` | `#FFFFFF` | Cards, panels, node bodies, sidebar |
| `bg-elevated` | `#F1F5F9` | Hover states on cards, table row alternation (slate-100) |
| `bg-hover` | `#E2E8F0` | Active hover states, selected rows (slate-200) |
| `bg-canvas` | `#FAFBFC` | ReactFlow canvas background with dot-grid pattern |

**Borders:**

| Token | Value | Usage |
|---|---|---|
| `border-primary` | `#E2E8F0` | Card borders, panel dividers, input borders (slate-200) |
| `border-subtle` | `#F1F5F9` | Faint separators, table row dividers (slate-100) |
| `border-strong` | `#CBD5E1` | Emphasized borders, active input focus fallback (slate-300) |

**Text:**

| Token | Value | Usage |
|---|---|---|
| `text-primary` | `#0F172A` | Primary text, headings, labels (slate-900) |
| `text-secondary` | `#475569` | Secondary text, descriptions, metadata (slate-600) |
| `text-tertiary` | `#94A3B8` | Placeholder text, disabled states, captions (slate-400) |

**Accent (Indigo):**

| Token | Value | Usage |
|---|---|---|
| `accent` | `#4F46E5` | Interactive elements, links, focus rings, active nav (indigo-600) |
| `accent-hover` | `#4338CA` | Hover state on accent elements (indigo-700) |
| `accent-subtle` | `#EEF2FF` | Accent backgrounds, selected states, badges (indigo-50) |
| `accent-muted` | `#C7D2FE` | Accent borders, progress indicators (indigo-200) |

**Semantic:**

| Token | Value | Usage |
|---|---|---|
| `success` | `#059669` | OK status, accepted mappings, high confidence (emerald-600) |
| `success-subtle` | `#ECFDF5` | Success backgrounds, accepted row highlights (emerald-50) |
| `warning` | `#D97706` | Amber alerts, medium confidence, pending review (amber-600) |
| `warning-subtle` | `#FFFBEB` | Warning backgrounds, review-needed highlights (amber-50) |
| `error` | `#DC2626` | Critical alerts, low confidence, errors (red-600) |
| `error-subtle` | `#FEF2F2` | Error backgrounds, rejected row highlights (red-50) |
| `info` | `#2563EB` | Informational alerts, lineage references (blue-600) |
| `info-subtle` | `#EFF6FF` | Info backgrounds, lineage highlights (blue-50) |

**Node Category Colours:**

| Category | Colour | Subtle BG |
|---|---|---|
| Source | `#3B82F6` (blue-500) | `#EFF6FF` (blue-50) |
| Transform/Mapping | `#059669` (emerald-600) | `#ECFDF5` (emerald-50) |
| Quality | `#D97706` (amber-600) | `#FFFBEB` (amber-50) |
| Sink | `#6366F1` (indigo-500) | `#EEF2FF` (indigo-50) |

**Agent Colours:**

| Agent | Colour | Subtle BG |
|---|---|---|
| Builder Agent | `#059669` (emerald-600) | `#ECFDF5` (emerald-50) |
| Analyst Agent | `#3B82F6` (blue-500) | `#EFF6FF` (blue-50) |

### Typography

| Role | Font | Fallback |
|---|---|---|
| Headings & Body | Inter | system sans-serif (Tailwind default) |
| Code / SQL / field names | Geist Mono | JetBrains Mono, monospace |

Inter is the standard typeface for modern enterprise SaaS. It offers excellent readability at small sizes, a wide weight range, and tabular number support critical for data-heavy interfaces. Geist Mono provides a clean, modern monospace for SQL, field names, and code blocks.

| Element | Size | Weight | Colour |
|---|---|---|---|
| Page heading | 24px / 1.5rem | 600 | `text-primary` |
| Section heading | 18px / 1.125rem | 600 | `text-primary` |
| Card heading | 15px / 0.9375rem | 600 | `text-primary` |
| Body text | 14px / 0.875rem | 400 | `text-primary` |
| Secondary text | 14px / 0.875rem | 400 | `text-secondary` |
| Small / caption | 12px / 0.75rem | 500 | `text-secondary` |
| Node label | 14px / 0.875rem | 600 | `text-primary` |
| Node subtitle | 12px / 0.75rem | 400 | `text-secondary` |
| Code / SQL | 13px / 0.8125rem | 400 | `text-primary` |

### Spacing

Base unit: 4px. Common values: 4, 8, 12, 16, 20, 24, 32, 40, 48.

### Radius

| Element | Radius |
|---|---|
| Buttons, inputs | 6px |
| Cards, panels | 8px |
| Nodes | 10px |
| Modals | 12px |
| Avatars, badges, status dots | 9999px (full round) |

### Elevation

Light themes rely on subtle shadows combined with borders for depth. Shadows are lighter than in dark themes.

| Level | Shadow |
|---|---|
| Surface | `0 1px 2px rgba(0,0,0,0.05)` |
| Elevated | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` |
| Modal | `0 4px 16px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)` |
| Focus ring | `0 0 0 2px var(--accent-subtle), 0 0 0 4px var(--accent)` (double ring) |

---

## 8. Clinical UI Patterns Applied

The following patterns are drawn from healthcare dashboard design research, modern enterprise SaaS UX (Pigment AI, Zeit AI, Linear), and adapted for CareMap's data engineering context.

### Confidence as a First-Class Visual Element

In clinical tools, users need to know how much to trust what they're seeing. CareMap uses confidence indicators consistently:

- **Colour-coded bars** on mapping suggestions: `success` fill for ≥85%, `warning` fill for 60-84%, `error` fill for <60%. Bars sit on a `bg-elevated` track.
- **Status dots** on nodes (`success` = healthy, `warning` = warnings, `error` = errors).
- **Data freshness timestamps** on every chart and query result, rendered in `text-tertiary`.
- Confidence is never the sole indicator — it's always paired with a number and/or a label.

### Alert Severity Hierarchy

Following clinical alert design principles, anomaly alerts use three levels:

- **Critical (red):** Requires immediate attention. Data may be actively causing incorrect downstream results. `error` icon, `error-subtle` background.
- **Warning (amber):** Should be reviewed. Data quality is degraded but downstream results may still be usable. `warning` icon, `warning-subtle` background.
- **Info (blue):** For awareness. No action required unless the user is investigating. `info` icon, `info-subtle` background.

Each alert shows impact (affected record count) so users can prioritise.

### Progressive Data Exploration

The dashboard supports drill-through at every level:

1. **Overview:** Dashboard shows summary metrics and alerts.
2. **Investigation:** Click a metric or alert to see the underlying records.
3. **Root cause:** Click a record to see its full lineage back to the source file and column.

This three-level drill pattern matches how clinical quality managers actually work: overview → investigate → root cause.

### Agent Plan-Review-Execute Pattern (from Pigment)

Borrowed from Pigment's Modeler Agent and adapted for clinical data:

1. **Intent:** User describes what they want in natural language.
2. **Plan:** Agent proposes a structured, numbered plan with estimated impact.
3. **Review:** User reviews the plan, can edit or request changes.
4. **Execute:** Agent proceeds only after explicit user approval.
5. **Iterate:** User can request corrections, triggering a new plan cycle.

This pattern applies to both the Builder Agent (pipeline construction) and the Analyst Agent (data queries). It ensures the human always has the final word on clinically sensitive decisions.

### Natural Language as Universal Interface (from Zeit AI)

Following Zeit AI's philosophy that natural language should drive every workflow — not just querying — CareMap allows users to:

- **Describe data integration intent:** "I have a German-language CSV with fall risk scores and patient IDs. Help me map it to the canonical model."
- **Describe analytical goals:** "Show me which wards have declining mobility scores over the last 90 days."
- **Describe corrections:** "The 'Station' column should map to ward, not patient ID. Fix the mapping and re-harmonize."

Natural language supplements — but does not replace — the visual canvas and direct manipulation interfaces. Users can always fall back to clicking and dragging.

### Cognitive Load Reduction

- **One thing at a time:** The inspector panel shows details for one selected node. The agent panel shows one agent conversation. You're never looking at two node configurations simultaneously.
- **Smart defaults:** High-confidence mappings are pre-accepted. The first-time canvas shows a helpful empty state with a clear call to action. Suggested prompts guide first-time agent interactions.
- **Consistent patterns:** Every table in the app (mapping suggestions, alert feed, quality results) uses the same row structure: status icon, primary text, secondary metadata, action buttons on the right. All tables use `bg-surface` backgrounds with `border-subtle` row dividers.

---

## 9. Interaction Specifications

### Node Drag-and-Drop

- User opens palette (click "+" or keyboard shortcut).
- Drags a node type from the palette.
- Drops it onto the canvas at the cursor position.
- Node appears with a "needs configuration" state (grey status dot, `text-tertiary` label).
- Palette closes automatically.

### File Upload to Source Node

- User selects a source node → inspector opens to the Upload tab.
- Drop zone shows: dashed `border-primary` border, `bg-app` background, upload cloud icon in `text-tertiary`, text "Drop a CSV file here or click to browse."
- User drops file → loading indicator appears on the node (spinner replacing status dot).
- Parse completes → node subtitle updates ("247 rows · 12 fields") in `text-secondary`.
- AI profiling begins → Profile tab auto-selects → columns appear one by one (streamed).
- Status dot transitions: grey → `warning` (profiling) → `success` (complete) or `error` (errors found).

### Edge Creation

- User hovers over a node's output port → port fills with category colour.
- User clicks and drags → rubber-band edge follows cursor in `accent` colour.
- User drops on another node's input port → edge snaps into place with `border-strong` colour.
- If it's a source→mapper connection, the Builder Agent activates in the agent panel with a proposed mapping plan.

### Mapping Review with Agent Plan

- Source→Mapper edge is created → agent panel opens with Builder Agent active.
- Builder Agent presents a plan card: "I'll map X columns from Y source to the canonical model. 8 mappings are high confidence, 2 need your review."
- User clicks "Approve" → mapping suggestions stream into the inspector's Mappings tab.
- Each row: source field, arrow, target field, confidence bar (on `bg-elevated` track), action buttons.
- User clicks "Accept" → row background transitions to `success-subtle`, moves to Confirmed tab.
- User clicks "Edit" → target field becomes a searchable dropdown with `bg-surface` background.
- User clicks "Reject" → row background transitions to `error-subtle`, marked as rejected.
- "Accept All High Confidence" button at top for bulk action (accent button style).
- "Harmonize" button at bottom (accent button style) triggers data write when at least one mapping is confirmed.

### Agent Query Flow (Analyst)

- User selects the Analyst Agent tile (or agent is already active).
- User types a question or selects a suggested prompt chip.
- Stepper advances through Mission → Scan → Analysis → Report → Outcome.
- Scan card shows which tables and joins will be used — user can verify.
- During Analysis, a "thinking" indicator with elapsed time appears.
- Report renders: text explanation + chart + collapsible execution details.
- Outcome shows follow-up question chips and pin button on charts.

### Pin to Dashboard

- User clicks "Pin to Dashboard" button on a chart (accent text, `accent-subtle` background).
- Brief confirmation toast: "Pinned to dashboard" with `success` icon and `success-subtle` background.
- Switching to Dashboard tab shows the new widget at the bottom of the pinned section.

---

## 10. Empty States and Error States

### Canvas — No Nodes

Centre of the canvas shows:
- Icon: nodes illustration in `text-tertiary`
- Heading: "Start by adding a data source" in `text-primary` weight 600
- Subtext: "Drag a source node from the palette or click the + button." in `text-secondary`
- The "+" button pulses gently with a subtle `accent-subtle` glow to draw attention.

### Source Node — No File

Upload tab shows:
- Large drop zone with dashed `border-primary` border and `bg-app` background
- Icon: upload cloud in `text-tertiary`
- Text: "Drop a CSV file here or click to browse" in `text-secondary`
- Accepted formats listed below in `text-tertiary`

### Agent Panel — No Data Harmonized

Agent selector tiles show both agents. Analyst Agent tile has a subtle `text-tertiary` label: "Harmonize data to start asking questions."

Builder Agent tile shows: "Upload a source file to get started."

### Agent Panel — First Visit

When agent panel opens for the first time, a brief onboarding card appears above the tiles:
- Heading: "Meet your AI agents" in `text-primary`
- Body: "CareMap has two specialized agents. The Builder helps you profile and map data. The Analyst answers questions about your harmonized data." in `text-secondary`
- "Got it" dismiss button

### Error — LLM Call Failure

Node or agent panel shows:
- `error-subtle` background card with `error` left border
- Error message: "AI analysis unavailable. Check your model configuration in Settings." in `text-primary`
- Retry button (accent outline style)
- Settings link in `accent` colour

### Error — SQL Execution Failure

Agent panel shows the error inline:
- `error-subtle` background card
- "I couldn't execute that query. Here's what went wrong:" in `text-primary`
- Error details in `code` font on `bg-elevated` background
- "Would you like me to try a different approach?" in `text-secondary`
- The agent self-corrects by default; this only shows if correction also fails.
