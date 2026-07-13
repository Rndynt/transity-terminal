---
name: RouteTimeline connector lines
description: Why per-row connector line segments in a vertical stop timeline should be drawn as one measured, absolutely-positioned line instead of stacked sibling divs.
---

In `client/src/components/cso/RouteTimeline.tsx`, the vertical line connecting stop circles is drawn as a single continuous absolutely-positioned line per segment, measured via `getBoundingClientRect()` on each stop circle (through refs) inside a `useLayoutEffect` + `ResizeObserver`, rather than each row drawing its own half-line with flexbox (`self-stretch`/`flex-1`).

**Why:** stacking independent sibling divs to fake one continuous line is fragile — sub-pixel/device-pixel-ratio rounding on real mobile browsers can produce a visible 1px seam between adjacent flex blocks even when desktop screenshots look fine. A user-reported mobile screenshot caught this after desktop-only screenshot verification had declared it fixed.

**How to apply:** when building any "timeline" style connector across multiple rows, prefer measuring real element positions and drawing one absolute line per segment over relying on multiple independently-sized DOM blocks to line up. Also: keep any array passed as a `useEffect`/`useLayoutEffect` dependency referentially stable (`useMemo`) — an inline `[...arr].sort()` recomputed every render will make the effect fire every render and can combine with a `ResizeObserver` on the same element to cause an infinite `setState` loop ("Maximum update depth exceeded"). Guard `ResizeObserver`-driven measurement effects by skipping `setState` when the computed value is unchanged (e.g. compare a stringified key), since the observer can retrigger after every state-driven re-render even for absolutely-positioned children that shouldn't affect layout size.

Also note: a thin (`w-0.5`, 2px) `bg-gray-200` line can be functionally correct but visually imperceptible in compressed screenshots/small viewports — use `bg-gray-300` or thicker (`w-[3px]`) for connector lines meant to be visible, and verify with a cropped/zoomed screenshot rather than judging a full-page screenshot by eye.
