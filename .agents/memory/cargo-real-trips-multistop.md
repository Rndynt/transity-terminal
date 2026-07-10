---
name: Cargo terminal must use real trips + multi-stop destinations
description: Cargo shipment booking has stricter trip-availability rules than passenger reservation, and destination resolution must consider every stop in the destination city, not just one.
---

Two intentional differences between the Cargo terminal and the passenger reservation (CSO) terminal in TransityTerminal:

1. **Only real/materialized trips can carry cargo.** Passenger reservation may show virtual (not-yet-materialized) trips because a booking triggers materialization later. Cargo requires a trip that already has a physical vehicle assigned — virtual trips must never appear in `/api/cargo/available-trips`.

2. **A destination city can have multiple stops**, and a single trip may pass through several of them after the origin. The passenger flow (`RouteTimeline`) already handles this by letting the rider pick any allowed stop along the route. Cargo's trip-availability data must expose *all* matching downstream stops for a trip (not just the first/nearest one), so the destination-outlet picker can offer every outlet along the route, not just one arbitrarily chosen stop.

**Why:** A prior bug merged virtual trips into cargo's trip list and collapsed the destination to a single "first matching stop after origin," so only one drop-off outlet ever appeared even when the route passed several valid ones.

**How to apply:** When touching cargo trip-search or destination-outlet logic, keep pricing/ETA tied to a stable "primary" stop if needed, but always carry the full list of valid destination stop IDs through to the frontend for outlet selection, and validate that the outlet actually chosen (not just the trip's default stop) matches what's submitted to the booking-create endpoint.
