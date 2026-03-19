---
name: caremap-design
description: >-
  Enforce CareMap's enterprise healthcare design system when building UI
  components, pages, or layouts. Use when creating React components, styling
  dashboards, building the agent panel, canvas nodes, inspector panels, or
  any frontend surface. Applies the project's light theme, design tokens,
  agent UX patterns (Pigment/Zeit-inspired), and clinical UI conventions.
  Triggers on: "build component," "style," "create page," "UI," "design,"
  "layout," "theme," "agent panel," "dashboard," "canvas," "node."
---

# CareMap Design System

This skill enforces the CareMap design language across all frontend work. Read [references/design-tokens.md](references/design-tokens.md) for the full token table when implementing colours, typography, or spacing. Read [references/agent-ux-patterns.md](references/agent-ux-patterns.md) for agent panel interaction patterns.

## Theme: Light, Calm, Professional

CareMap uses a **light theme only**. No dark mode. This is deliberate — enterprise healthcare users work in well-lit clinical offices. Light backgrounds make semantic colours (confidence bars, status dots, alerts) stand out with maximum clarity.

Reference products: **Pigment AI**, **Zeit AI**, **Linear**, **Notion**, **Figma**.

**Foundation palette:**
- App background: `#F8FAFC` (slate-50)
- Surfaces/cards: `#FFFFFF` (white)
- Borders: `#E2E8F0` (slate-200)
- Primary text: `#0F172A` (slate-900)
- Secondary text: `#475569` (slate-600)
- Accent: `#4F46E5` (indigo-600)

**Typography:** Inter for all text. Geist Mono for code/SQL/field names. No other fonts.

**Spacing:** 4px base unit. Use multiples: 4, 8, 12, 16, 20, 24, 32, 40, 48.

**Radius:** Buttons/inputs 6px, cards 8px, nodes 10px, modals 12px, badges 9999px.

## Core Visual Rules

1. **White card on light gray background.** Every card/panel is `#FFFFFF` with `#E2E8F0` border and subtle shadow `0 1px 2px rgba(0,0,0,0.05)`. No background gradients.
2. **1px borders everywhere.** Structure comes from borders, not shadows. Shadows are supplements, not primary.
3. **Semantic colour only where it means something.** Green = success/high confidence, amber = warning/review, red = error/critical, blue = info/accent. Never decorative.
4. **Restrained colour surface.** Use `-subtle` variants (`emerald-50`, `amber-50`, `red-50`, `blue-50`) for coloured backgrounds, never full-saturation backgrounds.
5. **No decorative elements.** No gradients, no illustrations, no background patterns (except the canvas dot-grid). Every pixel serves information.
6. **Typographic hierarchy carries the design.** Weight 600 for headings, 400 for body, 500 for captions. Size differentiation (24/18/15/14/12px) does the heavy lifting.

## Component Patterns

### Cards
```
bg-white border border-slate-200 rounded-lg shadow-sm p-4
```
Card heading: `text-sm font-semibold text-slate-900`. Metadata: `text-xs text-slate-500`.

### Tables
Alternating rows: white / `#F8FAFC`. Header: `bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide`. Row borders: `border-b border-slate-100`. Action buttons aligned right.

### Status Indicators
- Status dots: 8px circles, fully rounded. Green `#059669`, amber `#D97706`, red `#DC2626`, gray `#94A3B8`.
- Confidence bars: Height 6px, radius 3px, track `#F1F5F9`, fill uses semantic colour.
- Badges: `text-xs font-medium px-2 py-0.5 rounded-full`. Use `-subtle` bg + full colour text.

### Buttons
- Primary: `bg-indigo-600 text-white hover:bg-indigo-700 rounded-md px-3 py-1.5 text-sm font-medium`
- Secondary: `bg-white border border-slate-200 text-slate-700 hover:bg-slate-50`
- Destructive: `bg-red-600 text-white hover:bg-red-700`
- Ghost: `text-slate-600 hover:bg-slate-100`

### Input Fields
`bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600`

## Agent Panel UX (Pigment/Zeit Pattern)

The agent panel is the most UX-critical surface. It follows patterns from **Pigment AI** (multi-agent tiles, plan-approve-execute stepper) and **Zeit AI** (natural language as universal interface).

### Agent Selector Tiles
Two tiles shown when no conversation is active. Each is a card with left colour accent:
- **Builder Agent**: emerald accent `#059669`, wrench icon
- **Analyst Agent**: blue accent `#3B82F6`, chart icon

Selected state: `bg-slate-50` + coloured left border. Hover: `bg-slate-50`.

### Workflow Stepper
Horizontal stepper below agent header. Each step is a circle + label connected by lines.
- Completed: filled circle in agent colour + checkmark
- Active: filled circle in agent colour + pulse animation
- Future: `bg-slate-200` circle + `text-slate-400` label
- Line between completed steps: agent colour. Future lines: `#E2E8F0`.

**Builder steps:** Intent → Plan → Build → Iterate
**Analyst steps:** Mission → Scan → Analysis → Report → Outcome

### Plan Cards (Critical Pattern)
The agent presents a plan before executing. This is the **defining UX pattern** — borrowed from Pigment's Modeler Agent.

```
bg-slate-50 border border-slate-200 rounded-lg p-4
Left border: 3px solid [agent-colour]
```

Content: numbered list of proposed actions, summary stats ("10 high confidence, 2 need review").
Actions: `[Approve & Execute]` (primary button) + `[Edit Plan]` (secondary button).

### Execution Details (Collapsible)
Below every agent response. Collapsed by default. Shows SQL, tables, joins, lineage.
```
bg-slate-50 border border-slate-100 rounded-md p-3 font-mono text-xs
```

### Follow-Up Chips
After Analyst Agent outcomes: horizontally scrollable row of suggestion chips.
```
bg-white border border-slate-200 rounded-full px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer
```

## Canvas Nodes

Nodes sit on a `#FAFBFC` canvas with a subtle dot-grid pattern (`#E2E8F0` dots, 20px spacing).

Each node: `bg-white border border-slate-200 rounded-[10px] shadow-sm`, 180px min width, 80px min height. Left border 3px in category colour.

Category colours:
- Source: `#3B82F6` (blue)
- Transform: `#059669` (emerald)
- Quality: `#D97706` (amber)
- Sink: `#6366F1` (indigo)

Edges: `#CBD5E1` default, `#4F46E5` active (animated dash), `#DC2626` error.

Ports: 10px circles, `bg-slate-100 border border-slate-300`. Hover: fill with category colour.

## Dashboard Widgets

Grid layout, max 3 columns. Each widget is a white card with standard card styling.

**Completeness heatmap cells:** Use opacity gradient of the semantic colour, not distinct colour bands. `emerald-100` to `emerald-600` for good, `red-100` to `red-600` for poor.

**Alert feed items:** Left border in severity colour (3px). `bg-white` default, hover `bg-slate-50`. Unacknowledged items have subtle severity-coloured left accent.

**KPI stats:** Large number in `text-2xl font-semibold text-slate-900`. Label in `text-xs text-slate-500`. Optional trend arrow (green up / red down) in `text-sm`.

## Anti-Patterns — Never Do These

- **No dark backgrounds.** Not for cards, sidebars, headers, modals, or tooltips.
- **No coloured backgrounds on large surfaces.** Colour is for small indicators and subtle highlights only.
- **No gradient fills.** Not on buttons, cards, backgrounds, or charts.
- **No decorative icons or illustrations.** Every icon serves a functional purpose.
- **No rounded-full buttons** (except icon-only circular buttons like the "+" add node button).
- **No opacity hacks for text hierarchy.** Use the defined text colours (`slate-900`, `slate-600`, `slate-400`).
- **No custom fonts.** Inter and Geist Mono only. No DM Sans, Space Grotesk, Roboto, or system defaults.
- **No generic "AI" aesthetics** — no purple gradients, no glowing effects, no particle animations.

## Quick Decision Matrix

| Building... | Key reference |
|---|---|
| Agent panel component | See [references/agent-ux-patterns.md](references/agent-ux-patterns.md) |
| Canvas node or edge | Canvas Nodes section above + design specs §3 |
| Dashboard widget | Dashboard Widgets section above + design specs §5 |
| Form / settings page | Input Fields + Buttons patterns above |
| Data table | Tables pattern above |
| Alert or notification | Status Indicators section + semantic colours |
| Any new component | Start with white card on `bg-app`, add borders, use type hierarchy |

For full design token values, see [references/design-tokens.md](references/design-tokens.md).
For full design specs, see [docs/03-design-specs.md](../../../docs/03-design-specs.md).
