# TransityTerminal

Multi-operator bus transit ticketing system. Manages the full lifecycle of transit operations: route/schedule management, real-time seat inventory, passenger reservations, payments, cargo/waybill tracking, manifests, SPJ (travel orders), and financial reporting.

## Stack

- **Backend**: Node.js 20, Fastify 5, TypeScript (ESM)
- **Frontend**: React 18, Vite 5, Tailwind CSS, Radix UI, Wouter
- **Database**: PostgreSQL 16 (Drizzle ORM) — Replit built-in PostgreSQL
- **Real-time**: Socket.IO (in-memory adapter; Redis optional for multi-instance)
- **Auth**: Realmio (bypassed in dev via `DEV_BYPASS_AUTH=true`)

## Replit setup (completed)

The project was imported from GitHub and configured for Replit as follows:

- **Dependencies**: `npm install` run; `node_modules` present.
- **Database**: Replit built-in PostgreSQL 16 provisioned and reachable via the auto-injected `DATABASE_URL` environment variable. The `postgresql-16` Nix module is enabled in `.replit`.
- **Migrations**: Applied automatically on first boot via the app's built-in migrator (`server/db/migrate.ts`). On startup the server logs `schema database sudah up-to-date` when all migrations are current.
- **RBAC seed**: Roles (7), feature flags (55), and role-flag mappings (385) are seeded automatically on every boot.
- **Workflow**: `Start application` runs `npm run dev` (port 5000, `waitForPort = 5000`). Confirmed running and serving the React frontend.
- **Auth bypass**: `DEV_BYPASS_AUTH=true` is set in the development environment so the app works without a live Realmio tenant in dev.

## How to run

The **Start application** workflow runs `npm run dev` on port 5000. It starts automatically when you open the project.

Migrations and RBAC seeding run automatically on every boot — no manual step needed.

To seed demo data (routes, outlets, trips):
```
npx tsx server/seeds/index.ts nusa
```

## Structure

- `client/` — React frontend (Vite + React 18 + Wouter + TanStack Query)
- `server/` — Fastify backend (modules under `server/modules/`, repos under `server/repositories/`)
- `shared/` — Drizzle schema shared between client and server
- `scripts/` — DB migration and deploy helpers
- `migrations/` — SQL migration files applied by the built-in migrator

## Environment variables

All secrets are managed in Replit Secrets. Key ones:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Auto-provided by Replit built-in PostgreSQL — do not set manually |
| `JWT_SECRET` | Required in production (min 32 chars); set in Replit Secrets |
| `TERMINAL_SERVICE_KEY` | Service-to-service auth key; set in Replit Secrets |
| `DEV_BYPASS_AUTH` | `true` in development to skip Realmio; remove/set `false` in production |
| `REALMIO_BASE_URL` | Required in production for real Realmio auth |
| `REALMIO_TENANT_ID` | Required in production for real Realmio auth |
| `REDIS_URL` | Optional; enables multi-instance Socket.IO. Leave blank for single-instance. |

## User preferences

- Language: Indonesian (user communicates in Indonesian)
