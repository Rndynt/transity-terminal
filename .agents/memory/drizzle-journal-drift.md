---
name: Drizzle migration journal drift (TransityTerminal)
description: A migrations/*.sql file can exist on disk but be silently skipped by the app's drizzle-orm migrate() if it's missing from migrations/meta/_journal.json.
---

`drizzle-orm/node-postgres/migrator`'s `migrate()` only applies files listed in `migrations/meta/_journal.json` — it does not just glob the folder. If a migration SQL file was added without a matching journal entry, the migrator logs "schema database sudah up-to-date" and silently skips it, even on a fresh database.

**Why:** Hit this on a fresh import — `0024_passenger_price_matrix.sql` existed but wasn't in `_journal.json`, so `trip_patterns.allow_intra_city_booking` and the `passenger_price_matrices`/`passenger_price_exceptions` tables were missing after running the app's own migrator, causing seed script failures with "column does not exist". The `0024` file's own header comment says it's applied via `npm run db:push`, not the migrator — confirming `db:push` is the intended path for that change.

**How to apply:** If schema errors mention a column/table that a migration file clearly defines, check whether that file's `idx`/`tag` is present in `migrations/meta/_journal.json` before assuming the DB is broken. Running `npm run db:push` (drizzle-kit push) after the SQL migrator is safe here specifically because it only adds the missing delta on top of an already-created schema — see the separate `db:push` vs migrator note for when running push *first* is unsafe.
