# CareMap Design Tokens — Full Reference

## CSS Custom Properties

Apply these in `globals.css` or Tailwind config:

```css
:root {
  /* Backgrounds */
  --bg-app: #F8FAFC;
  --bg-surface: #FFFFFF;
  --bg-elevated: #F1F5F9;
  --bg-hover: #E2E8F0;
  --bg-canvas: #FAFBFC;

  /* Borders */
  --border-primary: #E2E8F0;
  --border-subtle: #F1F5F9;
  --border-strong: #CBD5E1;

  /* Text */
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-tertiary: #94A3B8;

  /* Accent (Indigo) */
  --accent: #4F46E5;
  --accent-hover: #4338CA;
  --accent-subtle: #EEF2FF;
  --accent-muted: #C7D2FE;

  /* Semantic */
  --success: #059669;
  --success-subtle: #ECFDF5;
  --warning: #D97706;
  --warning-subtle: #FFFBEB;
  --error: #DC2626;
  --error-subtle: #FEF2F2;
  --info: #2563EB;
  --info-subtle: #EFF6FF;

  /* Node categories */
  --node-source: #3B82F6;
  --node-source-subtle: #EFF6FF;
  --node-transform: #059669;
  --node-transform-subtle: #ECFDF5;
  --node-quality: #D97706;
  --node-quality-subtle: #FFFBEB;
  --node-sink: #6366F1;
  --node-sink-subtle: #EEF2FF;

  /* Agent colours */
  --agent-builder: #059669;
  --agent-builder-subtle: #ECFDF5;
  --agent-analyst: #3B82F6;
  --agent-analyst-subtle: #EFF6FF;

  /* Elevation */
  --shadow-surface: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-elevated: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-modal: 0 4px 16px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06);
  --ring-focus: 0 0 0 2px var(--accent-subtle), 0 0 0 4px var(--accent);

  /* Radius */
  --radius-sm: 6px;   /* buttons, inputs */
  --radius-md: 8px;   /* cards, panels */
  --radius-node: 10px; /* canvas nodes */
  --radius-lg: 12px;  /* modals */
  --radius-full: 9999px; /* badges, dots */

  /* Spacing (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

## Tailwind Mapping

When using Tailwind classes directly, these are the equivalents:

| Token | Tailwind Class |
|---|---|
| `bg-app` | `bg-slate-50` |
| `bg-surface` | `bg-white` |
| `bg-elevated` | `bg-slate-100` |
| `bg-hover` | `bg-slate-200` |
| `border-primary` | `border-slate-200` |
| `border-subtle` | `border-slate-100` |
| `border-strong` | `border-slate-300` |
| `text-primary` | `text-slate-900` |
| `text-secondary` | `text-slate-600` |
| `text-tertiary` | `text-slate-400` |
| `accent` | `text-indigo-600` / `bg-indigo-600` |
| `accent-hover` | `hover:bg-indigo-700` |
| `accent-subtle` | `bg-indigo-50` |
| `success` | `text-emerald-600` / `bg-emerald-600` |
| `success-subtle` | `bg-emerald-50` |
| `warning` | `text-amber-600` / `bg-amber-600` |
| `warning-subtle` | `bg-amber-50` |
| `error` | `text-red-600` / `bg-red-600` |
| `error-subtle` | `bg-red-50` |
| `info` | `text-blue-600` / `bg-blue-600` |
| `info-subtle` | `bg-blue-50` |

## Typography Scale

| Element | Classes |
|---|---|
| Page heading | `text-2xl font-semibold text-slate-900` (24px) |
| Section heading | `text-lg font-semibold text-slate-900` (18px) |
| Card heading | `text-[15px] font-semibold text-slate-900` |
| Body text | `text-sm text-slate-900` (14px) |
| Secondary text | `text-sm text-slate-600` |
| Caption | `text-xs font-medium text-slate-500` (12px) |
| Node label | `text-sm font-semibold text-slate-900` |
| Node subtitle | `text-xs text-slate-500` |
| Code / SQL | `font-mono text-[13px] text-slate-900` |

## Chart Colour Palette

For Recharts data series, use this ordered sequence:

```
#4F46E5  (indigo-600)  — primary series
#3B82F6  (blue-500)    — second series
#059669  (emerald-600) — third series
#D97706  (amber-600)   — fourth series
#DC2626  (red-600)     — fifth series
#8B5CF6  (violet-500)  — sixth series
```

Grid lines: `#F1F5F9`. Axis text: `#94A3B8` at 11px. Tooltip: white bg, `border-slate-200`, `shadow-elevated`.
