# Design

Internal B2B tool. Dense data, zero marketing. Reads like Linear's app, not Linear's homepage.

Guiding principles:

- **Calm, not loud.** Monochrome, one accent per state. Color carries meaning, never decoration.
- **Precision over decoration.** 1 px borders, no shadows except on modals, no gradients.
- **Numbers are first-class.** Mono, tabular, right-aligned, European format.
- **One pattern per job.** If two components do the same thing, delete one.

Everything below is enforceable. If the code disagrees with this doc, the code is wrong.

## Palette

Only tokens defined in `src/index.css` + a tiny set of semantic shades.

| Token | HSL | Role |
| --- | --- | --- |
| `--background` | `0 0% 100%` | page |
| `--foreground` | `240 10% 3.9%` | text, primary surfaces when inverted |
| `--card` | `0 0% 100%` | section surfaces |
| `--muted` | `240 4.8% 95.9%` | muted surfaces (hover, legend chips) |
| `--muted-foreground` | `240 3.8% 46.1%` | labels, meta, placeholders |
| `--border` | `240 5.9% 90%` | all borders |
| `--destructive` | `0 72% 51%` | errors, kritisch flag |

**Semantic accents** — use sparingly, only when meaning requires it:

- `destructive` → risk, errors, overdue
- `emerald-500` → actuals / completed revenue
- `amber-100 / amber-900` → attention (Abstimmen)
- `sky-100 / sky-900` → information (Urlaub)

**Not allowed:** `bg-blue-50`, `bg-indigo-*`, decorative pastels on group headers, "colored category" strips. If a column groups information, use a border or a label — not a pastel background.

## Typography

Two fonts only.

- `Inter` — all UI text
- `JetBrains Mono` + `tabular-nums` — every number, every ID, every initial-code

**Scale** (and nothing else):

| Role | Size | Weight | Case |
| --- | --- | --- | --- |
| Page title | `text-lg` (18 px) | 600 | Normal |
| Section title | `text-sm` (14 px) | 600 | Normal |
| Section subtitle | `text-xs` (12 px) | 400 | Muted |
| Body | `text-sm` (14 px) | 400 | Normal |
| Table cell | `text-sm` (14 px) | 400 | Normal |
| Meta / label | `text-xs` (12 px) | 500 | **UPPERCASE** `tracking-wider` muted |
| KPI value | `text-2xl` (24 px) | 600 | Mono, tabular |
| Chart label | `text-[10px]` | 400 | Mono, muted |

Line height: Tailwind defaults. Never override.

## Spacing

4 px base. Allowed values only: `0, 1, 1.5, 2, 3, 4, 6, 8, 12`.

- Section gap: `space-y-6` (24 px)
- Section inner padding: `p-4` (16 px)
- Section header padding: `px-4 py-3`
- Form row gap: `gap-3` (12 px)
- Inline element gap: `gap-2` (8 px)
- Icon ↔ label gap: `gap-1.5` (6 px)

Content width: `max-w-[1800px]` for data views, header matches content.

## Radii

Three only.

- `rounded` (4 px) — chips, flag badges, tiny inline
- `rounded-md` (6 px) — buttons, inputs, segmented controls
- `rounded-lg` (8 px) — sections, cards, modals

## Borders

- Always `1px solid hsl(var(--border))`.
- Separators inside a section: `border-b` (never full `rounded` nesting).
- No shadows anywhere except modal overlay content (`shadow-xl`).

## Icons

- `lucide-react` only. Stroke 1.5 (default).
- Default size `h-4 w-4` (16 px) in nav, buttons, badges.
- Compact size `h-3.5 w-3.5` (14 px) for inline affordances (hover-reveal delete, dialog close).
- Never larger than 16 px in dense data UI. Hero icons only inside dropzones (`h-6 w-6`).

## Numbers

Global rule (from memory): European format, mono, right-aligned.

- Table cells: `.num` class (mono + tabular + right).
- Thousands: narrow non-breaking space.
- Decimals: comma.
- Compact above 1 000: `fmtCompact` → `1,5 k`, `2,0 m`, `3,4 b`.
- Null / zero: render empty string, not `0`, except in totals.

## Primitives (single source of truth)

Everything below is in `src/components/ui/`. New views compose these — they never roll their own.

### `<Section>`

The only container. Every logical block uses it. Shape:

```
┌─────────────────────────────┐
│ Title              [action] │  ← px-4 py-3, border-b
│ Subtitle                    │
├─────────────────────────────┤
│                             │
│ body (p-4 by default)       │
│                             │
└─────────────────────────────┘
```

Props: `title`, `subtitle`, `action`, `padded` (set `false` for tables so the table owns its padding), `className`.

### `<KPICard>` + `<KPIGrid>`

`KPIGrid` is `grid grid-cols-2 md:grid-cols-4 gap-3`. Nothing else. If you need 6 across, you don't need 6 across.

`KPICard` fields: `label` (uppercase meta), `value` (mono 2xl), optional `unit`, optional `sub` (mono xs muted), optional `tone='danger'`.

### Buttons

Three variants only.

- **Primary** — `bg-foreground text-background rounded-md px-3 py-1.5 text-sm font-medium`
- **Secondary** — `border bg-card rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent`
- **Ghost / tertiary** — `text-xs text-muted-foreground hover:text-foreground` (no border, no bg)

Icon-only buttons use the ghost pattern with a 24 px tap target.

### Segmented control (tabs, period/quarter switcher)

Shape: `flex rounded-md border bg-card p-1`. Each item: `rounded px-3 py-1 text-sm font-medium`. Selected = inverted (`bg-foreground text-background`), unselected = `text-muted-foreground hover:bg-accent`.

### Sidebar nav item

`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium`. Selected = inverted. Icon `h-4 w-4`. Nothing else.

### Dialog

- Overlay: `bg-black/40` only (no blur).
- Content: `rounded-lg border bg-background shadow-xl`.
- Header + footer: `px-5 py-4` / `px-5 py-3`, `border-b` / `border-t bg-muted/30`.

## Tables

Dense, scannable, boring.

- `border-collapse`, `text-sm`.
- Header: `bg-card` or `bg-muted/40` (one, pick per table — not both in one table), `text-left`, `text-muted-foreground`, `font-medium`.
- Row border: `border-b last:border-b-0`.
- Cell padding: `px-3 py-2` for dashboard tables, `px-2 py-1` for editable grids.
- Number columns use `.num`. Flag/status badges use the chip rules below.
- No zebra striping. No colored group headers.

Pure sections of the forecast table (Projekt / Forecast / Abgerechnet / Leistungsstand) are communicated with **vertical borders only** (`border-l`), not pastel backgrounds.

## Status chips

Rounded 4 px, mono, 10 px semibold, inline. Allowed combinations:

| State | Classes |
| --- | --- |
| destructive / kritisch / Abgabe | `bg-destructive/10 text-destructive` |
| warning / Abstimmen | `bg-amber-100 text-amber-900` |
| info / Urlaub | `bg-sky-100 text-sky-900` |
| neutral / Frei / wahrscheinlich | `bg-muted text-muted-foreground` |

Never use these tints as full backgrounds on long surfaces.

## Charts

Hand-rolled SVG. No chart library.

- Axes: single baseline `stroke-border`.
- Bars: `fill-foreground/80` for the primary series, `fill-emerald-500` for actuals, `fill-destructive` for risk, each at 0.5 opacity when the quarter is not active.
- Labels: mono `text-[9px]` muted.
- Legends: small square `h-2.5 w-2.5 rounded-sm` + 12 px label, below the chart.

## Interaction

- **Autosave everywhere.** No Save buttons. A tiny mono status in the header: "Speichert…", "Gespeichert".
- **Hover** = `bg-accent` (never a tinted highlight).
- **Active / selected** = inverted (`bg-foreground text-background`).
- **Focus** = `focus:ring-1 focus:ring-ring`. Never dotted outlines.
- **Disabled** = `opacity-50 cursor-not-allowed`.

## German conventions

- UI copy is German. Buttons: `Importieren`, `Abmelden`, `Abbrechen`.
- Error messages lead with the fact, not the code: "Falsches Passwort", not "Error 401".
- Dates: ISO (`YYYY-MM-DD`) in data, long form in prose ("29. Oktober 2026") only if space allows.

## When adding something new

Four questions, in order:

1. Does an existing primitive cover this? Use it.
2. If not, is this a repeated pattern? Add a primitive to `src/components/ui/`.
3. Does it respect spacing/radii/typography above? If not, fix it before writing it.
4. Does it introduce a new color? Only if semantics require it. Add it to the Palette table.
