# CareMap Agent UX Patterns — Full Reference

Patterns derived from research into **Pigment AI** and **Zeit AI**, adapted for CareMap's healthcare data harmonization context.

## Architecture: Two Named Agents

CareMap surfaces two agents as first-class UI entities in a collapsible right sidebar (420px). This mirrors Pigment's AI Sidebar which shows agent tiles and lets users pick which agent to engage.

| Agent | Role | Colour | Workflow |
|---|---|---|---|
| Builder Agent | Profile sources, map fields, build data model | Emerald `#059669` | Intent → Plan → Build → Iterate |
| Analyst Agent | Query data, generate charts, investigate anomalies | Blue `#3B82F6` | Mission → Scan → Analysis → Report → Outcome |

## Agent Selector Tiles

When no conversation is active, show two tiles side by side. Derived from Pigment's AI Sidebar tile pattern.

```
┌──────────────┐  ┌──────────────┐
│ 🔧           │  │ 📊           │
│ Builder      │  │ Analyst      │
│ Agent        │  │ Agent        │
│              │  │              │
│ Profile,     │  │ Query, chart,│
│ map, build   │  │ investigate  │
└──────────────┘  └──────────────┘
```

**Tile styling:**
- Default: `bg-white border border-slate-200 rounded-lg p-4 cursor-pointer`
- Hover: `bg-slate-50`
- Selected: `bg-slate-50 border-l-3 border-l-[agent-colour]`
- Icon: 24px, agent colour
- Title: `text-sm font-semibold text-slate-900`
- Subtitle: `text-xs text-slate-500`

Once selected, tiles collapse into a compact agent header with icon + name + "Switch" dropdown.

## Builder Agent: Intent → Plan → Build → Iterate

Inspired by Pigment's **Modeler Agent** which follows Intent → Plan → Build → Iterate.

### Intent Phase
User describes need in natural language. The agent confirms understanding.

**UI:** Standard chat input. Agent response is a brief confirmation: "I'll profile 12 columns from your care assessment file and propose mappings to the canonical model."

### Plan Phase (Most Critical)
Agent presents a structured plan card for user approval. This is the **core trust-building pattern** — the agent never acts without showing its plan first.

**Plan Card structure:**
```
┌────────────────────────────────────────────┐
│ ● Plan                                      │  ← agent colour dot
│                                             │
│ 1. Profile 12 columns from                 │
│    care_assessments.csv                     │
│ 2. Classify domain: care assessments        │
│    (high confidence)                        │
│ 3. Map 10 fields to canonical model         │
│    (2 need your review)                     │
│ 4. Run quality check on mapped data         │
│                                             │
│ [Approve & Execute]        [Edit Plan]      │
└────────────────────────────────────────────┘
```

**Styling:**
- Container: `bg-slate-50 border border-slate-200 rounded-lg p-4`
- Left accent: `border-l-[3px] border-l-emerald-600`
- Steps: ordered list, `text-sm text-slate-700`
- Summary stats in parentheses: `text-slate-500`
- "Approve & Execute": primary button (indigo)
- "Edit Plan": secondary button (white/bordered)

### Build Phase
Agent executes the approved plan. Show progress step by step.

**UI:** Each step appears in the chat as a compact status line:
- `✓ Profiled 12 columns` (completed, `text-emerald-600`)
- `● Mapping 10 fields...` (in progress, agent colour + spinner)
- `○ Quality check` (pending, `text-slate-400`)

Results flow into the inspector panel simultaneously.

### Iterate Phase
Agent summarises results and invites corrections.

**UI:** Summary card + natural language input for corrections.
Example: User types "Map 'Station' to encounters.ward instead" → agent proposes amended plan → approve → re-execute.

## Analyst Agent: Mission → Scan → Analysis → Report → Outcome

Inspired by Pigment's **Analyst Agent** which follows Mission → Scan → Analysis → Report → Outcome.

### Mission Phase
User states analytical goal. Agent confirms scope.

**UI:** User types question. Agent echoes scope: "I'll analyse fall risk scores grouped by ward for the last 30 days."

### Scan Phase
Agent shows which data it will query before executing. User can verify scope.

**Scan Card structure:**
```
┌────────────────────────────────────────────┐
│ 🔍 Data Scan                                │
│                                             │
│ Tables: care_assessments, encounters        │
│ Join: care_assessments.encounter_id =       │
│       encounters.id                         │
│ Filter: assessment_type = 'fall_risk'       │
│         assessed_at ≥ 30 days ago           │
│                                             │
│ [Proceed]                  [Adjust Scope]   │
└────────────────────────────────────────────┘
```

**Styling:** Same as plan card but with `border-l-blue-500` (analyst colour).

For simple queries, the scan card can auto-proceed after a brief display (1-2 seconds) unless the user intervenes. For complex multi-table queries, wait for explicit approval.

### Analysis Phase
Agent builds SQL and executes. Show a thinking indicator.

**UI:**
- Thinking indicator: `● Analysing...` with elapsed time counter
- SQL execution details stream into a collapsible section below

### Report Phase
Results render as text narrative + inline chart + collapsible execution details.

**Chart container:** `bg-white border border-slate-200 rounded-lg p-4`. Pin button (📌) in top-right corner: `text-sm text-indigo-600 hover:bg-indigo-50 rounded px-2 py-1`.

**Execution details (collapsed by default):**
```
▸ Execution Details
  ┌──────────────────────────────────────┐
  │ SELECT e.ward, AVG(ca.score)...      │  ← font-mono, bg-slate-50
  │ Tables: care_assessments, encounters │
  │ Data freshness: 5 min ago            │
  └──────────────────────────────────────┘
```

### Outcome Phase
Agent suggests follow-up questions as horizontally scrollable chips.

**Chip styling:** `bg-white border border-slate-200 rounded-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer`

Also shows a "Save as Mission" button (future scope, for Pigment-style repeatable scheduled analyses).

## Cross-Agent Handoff

When the Analyst discovers a data issue (e.g., mapping error, unit conversion needed), it suggests handing off to the Builder Agent.

**Handoff chip:** `"Fix this mapping with Builder Agent"` styled as a chip with emerald accent.

On click:
1. Agent panel switches to Builder Agent
2. Context is preserved — Builder receives the issue description pre-loaded
3. Builder presents a fix plan for approval

This mirrors Pigment's multi-agent collaboration where agents hand off tasks seamlessly.

## First-Time Onboarding

On first visit, show an onboarding card above the agent tiles:

```
┌────────────────────────────────────────────┐
│ Meet your AI agents                         │
│                                             │
│ CareMap has two specialized agents:         │
│                                             │
│ 🔧 Builder — profiles data, maps fields,   │
│    builds your data model                   │
│ 📊 Analyst — answers questions, generates   │
│    charts, investigates anomalies           │
│                                             │
│ Both show their plan before acting.         │
│ You always have the final word.             │
│                                             │
│                            [Got it]         │
└────────────────────────────────────────────┘
```

Styling: `bg-indigo-50 border border-indigo-200 rounded-lg p-4`. Dismiss with "Got it" button, saved to localStorage.

## Key Principle: Plan Before Execute

Across both agents, the most important UX invariant is:

> **The agent always shows its plan before executing.** The user always approves before data is changed or queries are run.

This is non-negotiable for healthcare data tools. It mirrors Pigment's core philosophy: "Review the actions the Agent will take before it carries them out."

For low-risk read-only operations (Analyst Scan phase on simple queries), auto-proceed is acceptable with a brief display. For any write operation (harmonization, mapping changes), explicit approval is required.
