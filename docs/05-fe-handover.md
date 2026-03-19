# CareMap — Frontend Developer Handover

**Date:** March 19, 2026
**From:** Original developer (BE focus going forward)
**To:** Incoming FE developer
**Repo:** https://github.com/lettaz/CareMap
**Deploy:** Vercel (connected to repo, auto-deploys on push)

---

## 1. Quick Start

```bash
git clone https://github.com/lettaz/CareMap.git
cd CareMap
npm install
cd apps/web
npm run dev        # → http://localhost:5173
npm run build      # tsc -b && vite build (same as Vercel)
```

The app is fully client-side right now — no backend, no database. Everything runs on mock data. The backend (Fastify) will live in `apps/api` when ready.

---

## 2. Architecture at a Glance

```
CareMap/
├── apps/
│   └── web/              ← Vite + React 19 + TypeScript 5 SPA
│       ├── src/
│       │   ├── components/
│       │   │   ├── agent/          ← Chat UI: message thread, tool steps, artifact tabs, entity pills
│       │   │   ├── canvas/         ← ReactFlow nodes, inspector panels, context menu
│       │   │   ├── dashboard/      ← KPI cards, anomaly feed, heatmap, pinned widgets
│       │   │   ├── layout/         ← Top bar, sidebar nav, right panel, agent panel
│       │   │   ├── settings/       ← Model config, mapping thresholds
│       │   │   ├── shared/         ← Reusable: confidence bar, editable label, status dot
│       │   │   └── ui/             ← shadcn/ui primitives (button, dialog, tabs, etc.)
│       │   ├── hooks/              ← useActiveProject, useNodeRename
│       │   ├── lib/
│       │   │   ├── mock-data/      ← All mock data (sources, mappings, conversations, etc.)
│       │   │   ├── stores/         ← Zustand stores (pipeline, agent, dashboard, project)
│       │   │   ├── types/          ← All TypeScript interfaces
│       │   │   ├── constants.ts
│       │   │   └── utils.ts
│       │   └── routes/             ← Page components (canvas, dashboard, settings, projects)
│       └── ...config files
├── docs/                 ← Product docs, design specs, this handover
└── package.json          ← Root workspace: npm workspaces: ["apps/*"]
```

**Key tech:**
- **Vite 6** + **React 19** + **TypeScript 5**
- **React Router 7** (client-side routing)
- **ReactFlow 12** (canvas/pipeline builder)
- **Zustand** (state management, project-scoped stores)
- **Tailwind CSS 4** with custom design tokens (`cm-*` prefix)
- **shadcn/ui** (via `@base-ui/react`, NOT Radix — uses `render` prop, not `asChild`)
- **Recharts 2** (charts in dashboard and agent chat)
- **Lucide React** (icons)
- **Inter** + **Geist Mono** fonts

---

## 3. Key Architectural Decisions (Don't Undo These)

### Multi-Project Architecture
Each "project" is an isolated data-engineering task. The URL pattern is `/projects/:projectId/canvas` and `/projects/:projectId/dashboard`. All Zustand stores are keyed by `projectId` — `pipeline-store`, `agent-store`, `dashboard-store` all use `Record<string, ProjectData>` patterns.

### Single Unified AI Agent
We started with two agents (Builder/Analyst) but consolidated to **one single CareMap AI** agent. There is NO agent selector, NO workflow steppers, NO separate agent types. The agent is contextual based on where the user is (canvas vs dashboard). The old `agent-selector.tsx` and `workflow-stepper.tsx` are dead code — `agent-selector` was deleted, `workflow-stepper` is unused.

### Context-Aware Right Panel
The right panel (`right-panel.tsx`) dynamically switches content based on what's selected:
- **No node selected** → Agent chat panel
- **Source node selected** → Source detail panel (upload, analyze, preview)
- **Transform/Mapping node selected** → Mapping detail panel (per-field mapping table)
- **Quality/Sink node selected** → Generic node inspector

The panel is **resizable by dragging** the left edge (min 320px, max 900px). Width defaults change based on content type.

### Zeit AI-Inspired Conversation UI
The chat is NOT a bubble-based messenger. It's a **full-width document stream** inspired by Zeit AI:
- **User messages**: Plain text with inline entity pills
- **Agent messages**: Tool execution steps (collapsible) → rich content → approval blocks → artifact tabs (Overview/Table/Chart)
- Entity references use `{{entityId}}` markers in content strings that get rendered as interactive `EntityPill` components

### Canvas Node Context Menu
Right-clicking any node shows a context menu with "Send to Chat", "Recompute Node", and "Remove from Graph". "Send to Chat" creates a user message with the node as an entity pill.

---

## 4. Important Files to Know

| File | What It Does |
|---|---|
| `lib/types/index.ts` | ALL TypeScript interfaces. Start here. |
| `lib/stores/pipeline-store.ts` | Canvas state: nodes, edges, selection. Has `removeNode`. |
| `lib/stores/agent-store.ts` | Chat state. Seeds mock conversation on first session. |
| `lib/mock-data/conversations.ts` | The mock conversation showcasing all new UI patterns. |
| `lib/mock-data/mappings.ts` | 20 mock field mappings with sample values and reasoning. |
| `components/layout/right-panel.tsx` | The panel orchestrator — resizable, context-switching. |
| `components/layout/agent-panel.tsx` | Chat layout: empty state, mode/model selectors at bottom. |
| `components/agent/message-thread.tsx` | Document-stream renderer: UserBlock, AgentBlock, RichContent. |
| `components/agent/tool-steps.tsx` | Collapsible tool execution rows with status badges. |
| `components/agent/artifact-tabs.tsx` | Tabbed viewer: Overview, Table, Chart tabs. |
| `components/agent/entity-pill.tsx` | Inline entity reference chips. |
| `components/canvas/inspector/source-detail-panel.tsx` | Source node: upload → analyzing → preview flow. |
| `components/canvas/inspector/mapping-detail-panel.tsx` | Mapping node: per-field table, accept/reject, AI prompts. |
| `components/canvas/flow-canvas.tsx` | ReactFlow canvas with context menu wiring. |
| `components/canvas/node-context-menu.tsx` | Right-click menu: Send to Chat, Remove, etc. |

---

## 5. What's Working (Prototype State)

- Project listing and creation
- Canvas with 4 node types (source, transform, quality, sink)
- Node drag-and-drop from palette, edge connections
- Source node: CSV upload simulation → analyzing shimmer → rich data preview with column stats
- Mapping node: per-field mapping table with confidence, accept/reject, auto-accept, AI prompts
- Inline node renaming (double-click on canvas, click in panel)
- Resizable right panel with context-aware content
- Zeit AI-style conversation with tool steps, artifact tabs, entity pills, charts
- Node context menu with Send to Chat
- Dashboard with KPI cards, anomaly feed, completeness heatmap, pinned widgets
- Settings page with model config and mapping thresholds
- Mode/model selector on chat (Agent/Ask, CareMap Pro/Fast)

---

## 6. What's NOT Done Yet (Your TODO List)

### High Priority (for demo)
1. **Connect to real backend** — Replace mock data with API calls to `apps/api` (Fastify). The stores have `setMessages`, `setNodes`, etc. ready for this.
2. **Real file upload** — `source-upload-zone.tsx` simulates upload. Wire it to a real `/api/ingest` endpoint.
3. **Real AI responses** — Agent panel currently only adds user messages. Need streaming AI responses (tool steps appearing one-by-one, artifacts populating).
4. **Pipeline execution** — The "Harmonize" button and pipeline run logic is placeholder.

### Medium Priority
5. **Clean up dead code** — `workflow-stepper.tsx`, `plan-card.tsx`, `scan-card.tsx`, `execution-details.tsx`, `inspector-panel.tsx`, `upload-tab.tsx`, `profile-tab.tsx` are either unused or superseded by newer components.
6. **Quality node panel** — Currently shows a placeholder message. Should show quality check results.
7. **Sink/Store node panel** — Has a basic `StoreStatusTab` but needs real data.
8. **Dashboard interactivity** — Pinning from chat, drill-through on anomaly alerts, refresh on widgets.

### Nice to Have
9. **Responsive right panel** — The resize handle works but could have double-click to snap to preset widths.
10. **Keyboard shortcuts** — Cmd+K for search, Escape to close panels, etc.
11. **Chart types** — Only bar (horizontal) and line charts work. Add pie, heatmap.
12. **Animation polish** — Smoother transitions between panel content types.

---

## 7. Design System Quick Reference

All custom tokens use the `cm-` prefix in Tailwind. Defined in `src/index.css` under `@theme`.

| Token | Value | Usage |
|---|---|---|
| `bg-cm-bg-app` | `#F8FAFC` | Page background |
| `bg-cm-bg-surface` | `#FFFFFF` | Cards, panels |
| `bg-cm-bg-elevated` | `#F1F5F9` | Hover states |
| `text-cm-text-primary` | `#0F172A` | Headings |
| `text-cm-text-secondary` | `#475569` | Body text |
| `text-cm-text-tertiary` | `#94A3B8` | Placeholder |
| `bg-cm-accent` | `#4F46E5` | Primary actions (indigo) |
| `text-cm-success` | `#059669` | Accepted, high confidence |
| `text-cm-warning` | `#D97706` | Pending review |
| `text-cm-error` | `#DC2626` | Rejected, critical |
| `border-cm-border-primary` | `#E2E8F0` | Default borders |

Node category colours: Source blue (`#3B82F6`), Transform emerald (`#059669`), Quality amber (`#D97706`), Sink indigo (`#6366F1`).

Fonts: **Inter** (body), **Geist Mono** (code/data).

---

## 8. Gotchas & Known Issues

1. **shadcn/ui uses `@base-ui/react`**, not Radix. The `DialogTrigger` uses `render` prop, NOT `asChild`. This tripped up the Vercel build once already.
2. **`tsc -b`** is stricter than `tsc --noEmit`. Vercel runs `tsc -b && vite build`. Always test with `tsc -b` locally before pushing.
3. **Zustand stores are seeded with demo data** for `proj-001`. The agent store seeds `MOCK_CONVERSATION` on first session. If you don't see conversation data, refresh the page.
4. **ReactFlow node types must match** the `type` field in pipeline store nodes. Custom node types are registered in `flow-canvas.tsx` as `nodeTypes`.
5. **The root `package.json`** uses `npm workspaces: ["apps/*"]`. Run `npm install` from root, not from `apps/web`.
6. **`package-lock.json`** is committed (needed for Vercel). `pnpm-lock.yaml` is gitignored.

---

## 9. Backend Integration Points (For When BE Is Ready)

The frontend is structured to swap mock data for API calls. Here's what to wire:

| Frontend Action | Current Behaviour | Target API |
|---|---|---|
| File upload on source node | Simulates with timeout, loads mock preview | `POST /api/ingest` (multipart) |
| Send chat message | Adds to local store, no AI response | `POST /api/chat` (streaming) |
| Accept/reject mapping | Updates local state only | `PATCH /api/mappings/:id` |
| Harmonize pipeline | No-op | `POST /api/harmonize` |
| Load dashboard data | Reads from Zustand store (seeded) | `GET /api/dashboard` |
| Load project list | Reads from Zustand store (seeded) | `GET /api/projects` |

The agent store has `addMessage` and `setMessages` — when you integrate streaming, you'll want to stream tokens into a message and call `setMessages` on each chunk.

---

## 10. How to Run / Deploy

**Local dev:**
```bash
npm install          # from root
cd apps/web
npm run dev          # http://localhost:5173
```

**Vercel:**
- Connected to `lettaz/CareMap` on GitHub
- Root Directory: `apps/web`
- Framework: Vite
- Build Command: `npm run build`
- Output: `dist`
- Auto-deploys on push to `main`

**Type check (match Vercel):**
```bash
cd apps/web
npx tsc -b           # strict build check
npx vite build       # production build
```

---

## 11. Contact

If something doesn't make sense, check:
1. `docs/03-design-specs.md` — Full design system and UI specifications
2. `docs/04-trd-user-flows.md` — Technical requirements and user flows
3. `docs/01-solution-overview.md` — Product vision and capabilities
4. The mock data files — They document the expected data shapes better than any spec
