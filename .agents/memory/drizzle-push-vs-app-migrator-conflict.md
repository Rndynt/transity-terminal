---
name: db:push conflicts with app's own SQL migrator
description: Running `npm run db:push` (drizzle-kit push) on this project fights with server/migrator.ts, which applies migrations/*.sql itself on boot.
---

This project's server (`server/migrator.ts`) runs its own ordered `migrations/*.sql` files via `drizzle-orm`'s `migrate()` on every boot, and expects to own schema creation (enums, tables, etc.) from an empty `public` schema.

**Why:** Running `npm run db:push` first creates the same enums/tables directly from the Drizzle TS schema, untracked by the SQL migration history. When the app then boots and tries to run its own migrations, it fails with `type "X" already exists` because the objects already exist outside its migration bookkeeping.

**How to apply:** For this project, do not run `db:push` before first boot — let `npm run dev`/`npm start` run its own migrator against an empty schema. If `db:push` was already run and the app fails with "already exists" errors, recover by dropping and recreating the `public` schema (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`) — safe only if the DB has no data worth keeping — then restart the app so its migrator repopulates everything from scratch. Note: `scripts/post-merge.sh` in this repo runs `db:push` automatically after merges, which can reintroduce this drift; flag this to the user rather than silently editing it, since it's an existing project convention outside "just get it running" scope.
</content>
