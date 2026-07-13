---
name: Mobile floating action bar pattern (CSO booking UI)
description: How "floating" bottom action buttons must be implemented in this app's mobile panels to actually stay pinned, and why sticky/mt-auto attempts fail.
---

In the CSO booking flow (RouteTimeline, seat panel, PassengerForm), a "floating"
mobile action bar must be a `flex-shrink-0` **sibling** placed after a
`flex-1 overflow-y-auto` scrollable content block, inside a `h-full flex flex-col`
root — the same pattern PassengerForm's header already used correctly.

**Why:** `position: sticky bottom-0` (or `mt-auto` on a non-flex or nested
parent) only pins an element when scroll would otherwise push it past the
container edge. If the scrollable container's content is shorter than its
allotted height (very common on these panels), the "sticky" element just sits
in normal flow after the content — producing a visible gap before the next
element (e.g. the page footer), not a floating bar. This bug recurred twice
(once introduced by another agent, once almost repeated) because the visual
symptom (a gap on short-content screens) is easy to misdiagnose as a spacing
issue rather than a scroll-container-height issue.

**How to apply:** When adding/fixing a persistent bottom action bar in a
scrollable mobile panel, restructure as: root `h-full flex flex-col` →
scrollable content `flex-1 overflow-y-auto` → action bar `flex-shrink-0`
(no sticky, no backdrop-blur hacks needed). Verify by checking with SHORT
content (e.g. only 1 seat/passenger) — that's when the sticky bug reveals
itself; long content can mask it by coincidence.

**Edge-to-edge caveat:** if the component sits inside a CsoPage panel
wrapper that itself has horizontal/bottom padding (e.g. `p-3 md:p-5`), the
flex-shrink-0 bar inherits that inset and looks like it has an unwanted
gap on the sides/bottom (not actually a bug, just inherited padding).
Cancel it explicitly on the bar with `-mx-3 -mb-3` (matching the wrapper's
mobile padding value) plus the bar's own internal `px-3` for the button —
do NOT strip these negative-margin classes thinking they're leftover
sticky-hack cruft; they serve a real, separate purpose (breaking out of
an ancestor's padding to go full-width) and must stay even after removing
`sticky`. Where a component (e.g. PassengerForm) is reused at multiple call
sites with *inconsistent* wrapper padding (one has `p-3 md:p-5`, another
has none), standardize by removing the wrapper padding everywhere and
letting the component own 100% of its internal insets — negative margins
can't correctly cancel two different padding values at once.
