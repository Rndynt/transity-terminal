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
(no sticky, no negative margins, no backdrop-blur hacks needed). Verify by
checking with SHORT content (e.g. only 1 seat/passenger) — that's when the
sticky bug reveals itself; long content can mask it by coincidence.
