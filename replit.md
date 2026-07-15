# TransityTerminal

Multi-operator bus transit ticketing system. Manages the full lifecycle of transit operations: route/schedule management, real-time seat inventory, passenger reservations, payments, cargo/waybill tracking, manifests, SPJ (travel orders), and financial reporting.

## Stack

- **Backend**: Node.js 20, Fastify 5, TypeScript (ESM)
- **Frontend**: React 18, Vite 5, Tailwind CSS, Radix UI, Wouter
- **Database**: PostgreSQL (Drizzle ORM) — Replit built-in PostgreSQL
- **Real-time**: Socket.IO (in-memory adapter; Redis optional)
- **Auth**: Realmio (bypassed in dev via `DEV_BYPASS_AUTH=true`)

## How to run

The **Start application** workflow runs `npm run dev` on port 5000.

On first run (or after a fresh import), run migrations once:
```
npx tsx scripts/db-migrate.ts
```

To seed demo data:
```
npx tsx server/seeds/index.ts nusa
```

## Structure

- `client/` — React frontend
- `server/` — Fastify backend (modules under `server/modules/`, repos under `server/repositories/`)
- `shared/` — Drizzle schema shared between client and server
- `scripts/` — DB migration and deploy helpers

## Environment variables

All secrets are managed in Replit Secrets. Key ones:
- `DATABASE_URL` — auto-provided by Replit's built-in PostgreSQL
- `JWT_SECRET` — required in production (min 32 chars)
- `DEV_BYPASS_AUTH=true` — skips Realmio auth in development
- `REALMIO_BASE_URL` / `REALMIO_TENANT_ID` — required in production for real auth
- `TERMINAL_SERVICE_KEY` — service-to-service auth key

## User preferences

- Language: Indonesian (user communicates in Indonesian)
