# TransityTerminal

Multi-operator bus transit ticketing and terminal management system. Handles the full lifecycle of bus operations: route/stop management, real-time seat inventory, booking & reservations, payment processing, cargo/waybill tracking, SPJ generation, passenger manifests, and reporting.

## Stack

- **Frontend**: React 18, Vite 5, Tailwind CSS, Wouter, TanStack Query, Radix UI / shadcn
- **Backend**: Node.js 20, Fastify 5, TypeScript
- **Database**: PostgreSQL (Replit built-in) via Drizzle ORM
- **Real-time**: Socket.IO (in-memory adapter; Redis optional for multi-instance)
- **Auth**: Realmio (bypassed in dev via `DEV_BYPASS_AUTH=true`)

## Running the app

```bash
npm run dev        # Start dev server on port 5000
```

The "Start application" workflow runs `npm run dev` and is the entry point in Replit.

## Database setup (first time / fresh DB)

```bash
npm run db:push    # Apply schema via drizzle-kit push
# Then seed the migration tracking table (see below), then:
npx tsx server/seeds/index.ts nusa    # Seed nusa dataset
# OR
npx tsx server/seeds/index.ts buskita # Seed buskita dataset
```

### Important: migration tracking after db:push

The app's own migrator (`server/migrator.ts`) uses `drizzle.__drizzle_migrations` to track applied migrations.
After running `db:push` (which applies schema without recording in the journal), you must insert a sentinel row so the migrator skips re-running:

```sql
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('bootstrapped_via_db_push', 1773697703593);
```

This is already done in the current Replit environment.

## Environment variables

All secrets are managed via Replit Secrets. Key variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (auto-provided by Replit) |
| `JWT_SECRET` | JWT signing secret for mobile app (B2C) |
| `DEV_BYPASS_AUTH` | Set `true` in dev to skip Realmio auth |
| `TERMINAL_SERVICE_KEY` | Service-to-service auth key |
| `OPERATOR_SLUG` | Operator slug (e.g. `nusa`) |
| `OPERATOR_TZ` | Timezone (e.g. `Asia/Jakarta`) |
| `CONSOLE_URL` | TransityConsole URL (optional; skipped if empty) |
| `REDIS_URL` | Redis for Socket.IO scaling (optional; falls back to in-memory) |

## Seed datasets

- **nusa**: Bandung, Jakarta, Semarang, Yogyakarta — 15 stops, 34 trip bases, 476 trips, 27,440 seat inventory rows
- **buskita**: Alternative dataset

## User preferences

- Keep the existing project structure and stack — do not restructure or migrate.
