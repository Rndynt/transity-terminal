---
name: Migration index IMMUTABLE fixes
description: Three functional indexes in migration files used non-IMMUTABLE expressions on timestamptz columns, causing PostgreSQL 16 to reject them on a clean db-migrate run.
---

# Migration index IMMUTABLE fixes

## The rule
Do not use functional expressions on `timestamptz` columns in index definitions unless the function is explicitly marked `IMMUTABLE`. On PostgreSQL 16, both `(col AT TIME ZONE 'UTC')` and `(col::date)` are STABLE (not IMMUTABLE), so PostgreSQL rejects them in index expressions.

**Why:** PostgreSQL requires index expressions to be IMMUTABLE so they can be evaluated at write time without side effects. `AT TIME ZONE` and `::date` casts on `timestamptz` are STABLE because they depend on session timezone. Even 'UTC' doesn't make them IMMUTABLE in PostgreSQL's type system.

**How to apply:** When adding a functional index on a timestamp column, use plain column references (e.g. `ON table (col)`) or a truly IMMUTABLE expression like `EXTRACT(EPOCH FROM col)::bigint`. Never use `(col AT TIME ZONE 'text')` or `(col::date)` in index expressions.

## Files fixed
- `migrations/0016_cargo.sql` line ~131: changed `(paid_at::date)` → `paid_at`
- `migrations/0025_performance_indexes.sql` line ~131: changed `(paid_at AT TIME ZONE 'UTC')` → `paid_at`
- `migrations/0025_performance_indexes.sql` line ~162: changed `(paid_at AT TIME ZONE 'UTC')` → `paid_at`

## Also fixed in same run
- `migrations/0025_performance_indexes.sql` last line: `cargo_rates` index referenced old columns `scope, scope_ref_id` which no longer exist (table was redesigned to OD-matrix in `0016_cargo.sql`). Fixed to `(cargo_type_id, pattern_id, is_active)`.

## Reset procedure (clean DB)
When doing a full DB reset, both public tables AND drizzle schema must be cleared:
1. `DROP TABLE IF EXISTS ... CASCADE` on all public tables
2. Drop all public enum types (`pg_type WHERE typtype = 'e'`)
3. `TRUNCATE TABLE drizzle."__drizzle_migrations"` to clear migration history
4. Re-run `npx tsx scripts/db-migrate.ts`
