# TransityTerminal

**Sistem Ticketing Bus Transit Multi-Operator**

TransityTerminal is a full-stack bus terminal/operator ticketing system for bus, shuttle, and multi-stop travel. It supports CSO operations, routes, trips, seats, reservations, payments, cargo, SPJ, manifests, cashier, refund, reports, RBAC, real-time seat inventory, and schedule sync to TransityConsole.

## Stack

- **Backend**: Fastify (Node.js/TypeScript) — `server/`
- **Frontend**: React + Vite + Tailwind/shadcn — `client/`
- **Database**: PostgreSQL (Replit managed) via Drizzle ORM
- **Auth**: Realmio (bypassed in dev via `DEV_BYPASS_AUTH=true`)
- **Realtime**: Socket.io (in-memory adapter in single-instance dev)

## How to run

The workflow `Start application` runs `npm run dev` on port 5000.

Migrations run automatically on boot (`server/migrator.ts`). RBAC is seeded on every boot.

## Seeding

To (re)seed the nusa dataset:

```bash
npx tsx server/seeds/index.ts nusa
```

Available datasets: `nusa`, `buskita`.

## Key environment variables

See `.env.example` for the full list. In dev, the key ones are:

- `DATABASE_URL` — injected automatically by Replit
- `DEV_BYPASS_AUTH=true` — skips Realmio auth
- `TERMINAL_SERVICE_KEY` — service-to-service key (dev: `sk_dev_test_key_12345`)
- `SESSION_SECRET` — set as a Replit secret

## User preferences

- Use existing project structure; do not restructure or migrate the stack.
- Keep Indonesian language conventions in seed data and operator context.
