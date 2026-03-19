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

**AI as a contextual partner.** Inspired by Zeit AI's document-style conversation UI, CareMap embeds a single unified AI agent that adapts to the user's context. On the canvas, it helps profile and map data. On the dashboard, it helps analyze and explore. The user never "selects" an agent — the AI understands context from what's selected and where the user is working. Every AI action is transparent (tool execution steps, reasoning, provenance).

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

**Right panel:** Persistent right sidebar, collapsible and resizable (drag left edge). Default 420px for chat, wider for data panels. Toggles via top bar button. Content is context-aware: shows the AI chat when no node is selected, switches to node-specific detail panels (source, mapping, etc.) when a node is selected. See Sections 3 (Inspector) and 4 (Agent Panel) for details.

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

Categories, their visual colour, and each node's responsibility:

| Category | Colour | Nodes | Responsibility |
|---|---|---|---|
| Sources (blue) | `#3B82F6` | CSV Source, Excel Source, PDF Source, Text Source | Ingest, parse, and AI-profile a single data file. Outputs a profiled dataset. |
| Transforms (emerald) | `#059669` | Mapping | Align one or more profiled sources to the canonical clinical model. AI proposes column mappings, detects joins, derives constants. User reviews target-by-target. |
| Quality (amber) | `#D97706` | Quality Check | Validate data after transformation: null rates, range checks, duplicates, format issues. |
| Sinks (indigo) | `#6366F1` | Harmonized Store | Write validated, mapped data into the canonical Supabase tables. |

**Pipeline principle:** Each node does one job. Source nodes profile. Mapping nodes align. Quality nodes validate. Sink nodes write. Users can compose these in any order, and each node's panel shows exactly what that node's job produced. The AI helps at every step, but the user always reviews and approves.

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

### Context-Aware Right Panel

The right panel **replaces the chat panel** when a node is selected, and reverts to chat when deselected. It is a single resizable panel, not a second panel alongside chat.

**Default widths by content:**
- Agent chat: 420px
- Source detail panel: 580px
- Mapping detail panel: 560px
- Other node types: 420px

**Resizing:** Drag the left edge of the panel. Min 320px, max 900px. The drag handle shows a subtle hover highlight.

**For source nodes — Source Detail Panel:**

A stateful panel with three phases:
1. **Upload** — Drop zone for file upload. Dashed border, cloud icon. Accepts CSV/Excel.
2. **Analyzing** — Shimmer animation and AI analysis progress (profiling, semantic mapping, quality assessment).
3. **Preview** — Rich data table with column-level insights:
   - AI-generated summary bar (total records, mapped fields, data quality score)
   - Scrollable data table with sticky header row
   - Column headers clickable for popover showing type, semantic label, confidence, sample values
   - Contextual AI prompt chips at the bottom

**For mapping nodes — Mapping Detail Panel (Target-Centric):**

The mapping panel answers: "What does each target table look like when assembled?" — not just "Where does each source column go?"

**Layout:**
- Header: Editable label, global stats (N target tables, N columns, N need attention)
- Global summary badges: mapped, derived, review, gaps, orphans
- Tabbed interface with one tab per target table + Joins tab + Orphans tab
- AI prompt chips at bottom (contextual to active tab)

**Each target table tab shows:**
- Table header: canonical table name, completion badge (N/M covered), source files contributing
- Column list ordered by schema position, each row showing:
  - Target column name, data type, required badge
  - Status: Mapped (green), Derived (indigo), Review (amber), Gap (red)
  - Source column preview (← sourceColumn) for mapped columns
  - Expandable detail showing: source file reference with sample value, confidence, AI reasoning, transformation rule, and accept/reject buttons for pending mappings
  - For gaps: explanation of what's missing + whether required or optional
  - For derived columns: derivation logic (e.g., "assessment_type derived from column name")

**Joins tab:** Shows detected relationships between target tables, with the shared source column that enables the join and a confidence score per relationship.

**Orphans tab:** Lists source columns that have no target. Each orphan shows its sample value, low confidence score, and buttons to "Suggest target" or "Discard."

**Key insight:** Multiple score-type source columns (Sturzrisiko_Skala, Mobilität, Ernährung, etc.) map to the same target column (care_assessments.score) via row pivoting — each becomes a separate row with a derived assessment_type. The target-centric view makes this transformation strategy visible.

**For quality check nodes:**
- Quality metrics: completeness percentages, range check results, detected anomalies.

**For harmonized store nodes — Store Status Tab:**
- Write status, record counts, last harmonization timestamp.
- Schema view of canonical tables this pipeline writes to.

---

## 4. The Agent Panel (Zeit AI-Inspired)

### Design Rationale

CareMap uses a **single unified AI agent** ("CareMap AI") rather than multiple named agents. Inspired by Zeit AI's conversation UI, the chat panel uses a **full-width document stream** instead of traditional chat bubbles. The AI is contextual — it adapts to what the user is doing (pipeline building vs data analysis) without requiring explicit agent selection.

### Layout

Right sidebar, resizable by dragging the left edge. Default widths vary by content (420px for chat, 560–580px for data-heavy panels). Min 320px, max 900px. `bg-app` background. Collapsible via the top bar toggle.

**Anatomy:**

```
┌──────────────────────────────┐
│                              │
│  [User message with          │  ← full-width, no bubbles
│   inline entity pills]       │
│                              │
│  ┌────────────────────────┐  │
│  │ ⊕ Profiling  src.csv ✓ │  │  ← collapsible tool steps
│  │ ⊕ Mapping → target  ✓ │  │     with status badges
│  │ ⊕ Quality checks    ✓ │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ Overview │ 247 table │  │  │  ← tabbed artifact viewer
│  │──────────────────────── │  │
│  │ Rich content / chart /  │  │
│  │ data table             │  │
│  └────────────────────────┘  │
│                              │
│  ┌─ Accepted ─────────────┐  │  ← approval block
│  │ ✓ Mapping proposal     │  │
│  │   has been accepted     │  │
│  └────────────────────────┘  │
│                              │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │ Ask anything about     │  │  ← input at bottom
│  │ your data...           │  │     (auto-expanding textarea)
│  │ [📎] [🖼]          [↑] │  │
│  └────────────────────────┘  │
│  ⊕ Agent ▾  ⚡ CareMap Pro ▾ │  ← mode/model selectors
└──────────────────────────────┘
```

### Conversation UI Components

**Entity Pills:** Inline references to data assets rendered as rounded chips with type-specific icons (table, column, source, chart). Include optional hash IDs. Example: `[📊 247 care_assessments]`. Used in both user prompts and AI responses via `{{entityId}}` markers.

**Tool Execution Steps:** Collapsible rows in a bordered card showing what the AI did. Each step has:
- Step icon (search, edit, chart, table, check)
- Label with inline entity pills
- Status badge: green "Success (0.02s)" or spinning loader
- Expandable detail section (SQL, profiling output, etc.)

**Artifact Tabs:** A horizontal tab bar below AI responses with:
- **Overview** tab — rich formatted text (bold, bullet points)
- **Table** tabs — scrollable data tables with sticky headers, hash IDs (e.g., `247 care_assessments`)
- **Chart** tabs — interactive Recharts visualizations (horizontal bar, line), hash IDs
- **+** button for requesting new artifacts

**Approval Blocks:** Inline status indicators:
- Accepted (green): "Mapping proposal has been accepted"
- Pending: Shows Accept/Reject buttons
- Rejected (red): Shows rejection message

### Input Area

At the **bottom** of the panel. Auto-expanding textarea in a rounded card with:
- Placeholder: "Ask anything about your data..."
- Attach file and attach image buttons (left)
- Send button (right, blue when active)
- Below the input: Mode selector (Agent/Ask) and Model selector (CareMap Pro/CareMap Fast) as dropdown buttons

When no messages exist, an **empty state** fills the center:
- CareMap AI icon and description
- "Try asking" section with clickable suggestion buttons
- Clicking a suggestion populates the input (does not auto-send)

### Canvas Context Menu Integration

Right-clicking any node on the canvas shows a context menu with:
- **Send to Chat** — Creates a user message with the node as an EntityPill, opens the chat panel
- **Recompute Node** — Re-runs the node's processing
- **Remove from Graph** — Deletes the node and its connected edges

This bridges the visual pipeline builder with the conversational AI.

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

**Agent Colour:**

| Agent | Colour | Subtle BG |
|---|---|---|
| CareMap AI | `#4F46E5` (indigo-600) | `#EEF2FF` (indigo-50) |

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

### Transparent AI Execution Pattern (from Zeit AI)

Borrowed from Zeit AI's document-style conversation UI:

1. **User intent:** User describes what they want in natural language, optionally referencing data assets via entity pills.
2. **Tool execution:** The AI shows collapsible execution steps (profiling, mapping, quality checks) in real time with status badges and durations.
3. **Rich output:** Results appear as tabbed artifacts (overview text, data tables, interactive charts) inline in the conversation.
4. **Approval gate:** For consequential actions (accepting mappings, harmonizing data), an approval block asks for explicit user confirmation.
5. **Iteration:** User can follow up conversationally. The AI maintains context.

This ensures the human always sees what the AI did, how long it took, and retains approval authority on clinically sensitive decisions.

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

### Mapping Review (via Mapping Detail Panel)

- Source→Mapper edge is created → user clicks mapping node → right panel switches to Mapping Detail Panel.
- AI generates mapping suggestions shown as a table with per-field rows.
- Each row: source column, sample value, arrow, target table.column, confidence %, status badge.
- User clicks a row to expand → shows AI reasoning, transformation rule, Accept/Reject/Reset buttons.
- "Auto-accept high confidence" button at top for bulk acceptance.
- "Show issues only" filter to focus on uncertain/unmapped fields.
- AI prompt chips at bottom: "Fix unmapped fields", "Optimize transformations", etc.

### Conversational Query Flow

- User types a question in the chat input or clicks a suggestion chip.
- Chat input is at the **bottom** of the agent panel. Clicking suggestions populates the input (does NOT auto-send).
- AI responds with a document-style message: tool execution steps (collapsible), rich content, artifact tabs.
- Tool steps show real-time status: "Profiling care_assessments.csv... Success (0.02s)".
- Artifact tabs display Overview (formatted text), Table (interactive data), Chart (Recharts visualization).
- Approval blocks appear for consequential actions (user confirms or rejects inline).

### Canvas → Chat Bridge

- Right-click any node on the canvas → context menu appears at cursor position.
- "Send to Chat" creates a user message with the node as an entity pill and opens the chat panel.
- "Remove from Graph" deletes the node and all connected edges.
- Clicking anywhere else on the canvas closes the context menu.

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

### Agent Panel — Empty State

When no conversation exists, the panel shows a centered empty state:
- CareMap AI icon (sparkles) with indigo gradient background
- Heading: "CareMap AI" in `text-primary`
- Description: "Ask me to profile your data, suggest mappings, generate charts, or explore insights." in `text-secondary`
- "Try asking" section with 3 clickable suggestion buttons
- Clicking a suggestion populates the chat input (does not send)

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
