# beUI integration (branch: `redesign`)

Source: https://github.com/starc007/ui-components ("beUI") — a shadcn-style,
copy-the-source motion component library (Next.js + Tailwind v4 + `motion`).

## What was brought in

62 component files copied verbatim into `client/src/components/motion/`
(mirrors upstream's own folder layout so it's a straight import, no path
rewriting). Skipped: components needing Next.js (`theme-toggle`), or heavy/
irrelevant deps not worth adding (`shader-background`, `smooth-scroll`,
`infinite-masonry`, crypto-demo `swap/` + `wallet-card/`, the `not-found/`
404 demo).

Supporting libs copied to match beUI's own `@/lib/*` imports:
- `client/src/lib/ease.ts` — shared easing curves / spring presets
- `client/src/lib/tick-sound.ts` — synth tick sound (WheelPicker)
- `client/src/lib/hooks/use-hover-capable.ts` — hover-capable device detection

New dependencies installed: `motion`, `@tanstack/react-virtual` (used by
`table/`).

## Compatibility fixes (project is Tailwind v3.4 + React 18, beUI targets v4 + React 19)

- Added `client/src/types/react-inert.d.ts` — augments `HTMLAttributes` with
  `inert` (only in React 19's types), used by `popover.tsx`.
- Added `--border-strong` and `--success` CSS variables + Tailwind color
  tokens (`index.css` / `tailwind.config.ts`), following the existing
  shadcn token convention. `select.tsx`, `otp-input.tsx`,
  `copy-menu.tsx`, `feedback-widget.tsx`, `input.tsx` used these.
- Rewrote Tailwind v4-only `bg-(--color-success)` / `border-(--color-...)`
  shorthand to plain v3 token classes (`bg-success`, `border-border-strong`).

## Available components

`client/src/components/motion/`:
`action-swap`, `animated-badge`, `animated-number`, `animated-toast-stack`,
`bouncy-accordion`, `checkbox`, `command-palette`, `drawer`, `bottom-sheet`,
`expandable-action-bar`, `expandable-tabs`, `expanding-arrow-button`,
`feedback-widget`, `file-upload`, `input`, `loader`, `magnetic`,
`notification-stack`, `number-ticker`, `otp-input`, `overflow-actions`,
`popover`, `popover-morph`, `pull-to-refresh`, `radio`, `range-slider`,
`select`, `switch`, `swipeable-list`, `tabs`, `tooltip`, `wheel-picker`,
plus multi-file sets: `button/` (Button, StatefulButton, MagneticButton),
`table/` (virtualized data table — sort, resize, reorder, row selection),
`availability-scheduler/` (day-by-day time-range scheduler — worth
wiring into `SchedulerPage`).

## Live preview

`/redesign-preview` — a plain route (no feature flag, still requires login),
demoing most of the components above. Not linked from the sidebar; open it
directly by URL.

## Suggested next steps

- Swap `AvailabilityScheduler` into `SchedulerPage` for the trip-pattern
  schedule editor.
- Swap `table/` into `AllBookingsPage` / `SpjPage` for sortable/resizable
  columns.
- Replace shadcn `Tooltip`/`Popover`/`Switch` usages page-by-page with the
  beUI equivalents where the extra motion is worth it — not a blanket
  find-replace, existing Radix-based `components/ui/*` still works fine.
