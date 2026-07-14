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

### Performance load seed (large dataset for benchmarking)

Generates ~60K trips, 840K seat_inventory rows, ~260K bookings/passengers/payments per run. Use `--prefix` to distinguish batches:

```bash
# First batch (PL- prefix)
npx tsx server/seeds/perfload/index.ts

# Second batch (different prefix to avoid unique constraint conflicts)
npx tsx server/seeds/perfload/index.ts --prefix PL2-

# Clean up a specific batch
npx tsx server/seeds/perfload/index.ts --prefix PL- --clean
```

### EXPLAIN ANALYZE

Run all 20 query EXPLAIN ANALYZE and generate `docs/query-performance.md`:

```bash
npx tsx docs/run-explain.ts --md
```

Raw output in `docs/explain-results.txt` / `.json`.

## Performance optimizations (migration 0026+)

### `mv_trip_stats` materialized view

Precomputes per-trip booking stats (booking counts by status, `paid_revenue`, `active_pax`) so report queries aggregate ~60–120K view rows instead of scanning 500K+ raw bookings live.

- **Auto-refreshed every 5 minutes** by the scheduler (`REFRESH MATERIALIZED VIEW CONCURRENTLY`). No manual action needed.
- Reports tolerate ≤5 min staleness; reports with outlet/channel filters always use the live query (real-time).
- If the view doesn't exist (pre-migration env), the refresh call is silently skipped.

**Benchmark results (2× perfload dataset):**
| Query | Before | After |
|---|---|---|
| Q01 `getCsoAvailableTrips` | ~2,648 ms | <400 ms |
| Q06 `getRevenueSummary` | ~1,477 ms | ~82 ms |
| Q12 `getLoadFactor` | ~2,311 ms | ~118 ms |

### `getRealTripsForCso` CTE restructure

The CSO available-trips query now starts from `outlet_trips` (most selective: trips at this outlet on this date, ~80 rows) instead of loading all 2000+ trips for the date. The `boarding_check` CTE was also fixed from a correlated subquery to a JOIN.

### Report staleness UI

Report pages that use the MV fast path show a blue info banner: **"Data diperbarui otomatis setiap ±5 menit."**

- **Load Factor** — always shows banner (always uses MV for pax counts)
- **Revenue / Sales** — banner shown only when departure mode + no outlet/channel filter (currently not reachable from default UI, but handled for correctness)

## Key environment variables

See `.env.example` for the full list. In dev, the key ones are:

- `DATABASE_URL` — injected automatically by Replit
- `DEV_BYPASS_AUTH=true` — skips Realmio auth
- `TERMINAL_SERVICE_KEY` — service-to-service key (dev: `sk_dev_test_key_12345`)
- `SESSION_SECRET` — set as a Replit secret
- `RESERVATION_ENGINE_ENABLED` — set `true` to use Rust sidecar for seat holds

## User preferences

- Use existing project structure; do not restructure or migrate the stack.
- Keep Indonesian language conventions in seed data and operator context.
