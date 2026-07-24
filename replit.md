# TransityTerminal

A multi-operator bus transit ticketing and operational system. Manages the full lifecycle of transit services: route/schedule management, real-time seat inventory, passenger reservations, cargo tracking, and financial reporting.

## Stack

- **Backend**: Node.js 20, Fastify 5, TypeScript (ESM)
- **Frontend**: React 18, Vite 5, Tailwind CSS, Radix UI, Wouter, TanStack Query
- **Database**: PostgreSQL (Replit managed) with Drizzle ORM
- **Real-time**: Socket.IO (in-memory adapter; Redis optional for multi-instance)

## How to run

`npm run dev` — starts Fastify + Vite dev server on port 5000.

The workflow "Start application" is configured and runs this automatically. Migrations run at boot via `server/migrator.ts`.

## Environment

All secrets are configured in Replit Secrets. Key ones:
- `DATABASE_URL` — provided automatically by Replit's managed PostgreSQL
- `DEV_BYPASS_AUTH=true` — dev mode skips Realmio identity provider
- `RESERVATION_ENGINE_ENABLED=false` — uses built-in AtomicHoldService

See `.env.example` for the full list and documentation of each variable.

## Project structure

```
server/          Backend (Fastify, routes, modules)
  modules/       Feature modules (bookings, cargo, spj, …)
  migrator.ts    Drizzle migration runner (auto-runs on boot)
client/          Frontend (React + Vite)
shared/          Shared Drizzle schema definitions
migrations/      SQL migration files (managed by Drizzle)
```

## Seeding

Data is already seeded with the **nusa** dataset (Nusa Shuttle — Jakarta/Bandung/Semarang/Yogyakarta routes).

To re-seed from scratch:
```bash
# Non-trip data (stops → cargo) — fast
CONSOLE_URL="" npx tsx server/seeds/index.ts nusa

# Trip materialization in parallel (much faster than the built-in sequential seed)
CONSOLE_URL="" npx tsx scripts/seed-trips-parallel.ts 14 10
```

`scripts/seed-trips-parallel.ts` accepts `<days> <concurrency>` args (default 14 days, 10 concurrent).

## User preferences

- Keep existing project structure and stack — do not restructure or migrate.
