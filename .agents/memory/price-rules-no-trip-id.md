---
name: price_rules table has no trip_id column
description: Clarifies which pricing table owns per-trip vs per-pattern price overrides in TransityTerminal's schema; a query joining price_rules.trip_id is a code bug, not a missing migration.
---

`price_rules` (shared/schema/pricing.ts) is scoped to `pattern_id` / global only — it never had a `trip_id` column. Per-trip, per-OD price overrides live in the separate `price_rule_exceptions` table, which does have `trip_id`.

**Why:** A query in `server/repositories/scheduling.repository.ts` (`getRealTripsForCso`) had a leftover CTE selecting `pr.trip_id` from `price_rules`, causing `column pr.trip_id does not exist` (42703) on every CSO available-trips lookup. This is not schema drift fixable by `db:push` or migrations — the column was never meant to exist there.

**How to apply:** If you see `pr.trip_id`/`price_rules.trip_id` errors, fix the query to key off `pattern_id` only (or join `price_rule_exceptions` if per-trip granularity is actually needed), don't add a migration to create the column.
