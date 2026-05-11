# Reservation Engine — Contract Specification & Build Guide

This document is the **authoritative contract** for the core reservation engine
of TransityTerminal (a multi-operator bus ticketing system built with
Node.js + Fastify + Drizzle + PostgreSQL).

It is intended to be used in TWO ways:

1. **As a build prompt** for an AI agent (Replit Agent, Claude, Cursor, etc.) in a
   **separate project** that will implement this engine in another language
   (Rust is the recommended target). See **Section 0** below.
2. **As a behavioral reference** so any new implementation stays 1:1 compatible
   with the existing Node.js engine.

Version: 1.0 — Snapshot of production code, April 2026.

---

## Section 0 — Prompt for a New Replit Agent (copy/paste)

> Paste everything between the `<<<` markers below into a fresh Replit project
> after creating an empty Rust template. The Agent will then have full context
> to build the engine.

```
<<< BEGIN AGENT PROMPT

You are building a standalone microservice called "reservation-engine".

GOAL
----
Build an HTTP/JSON microservice in Rust that owns the seat-inventory state
machine for a bus ticketing system. The service is the single source of
truth for who holds, books, releases, and cancels seats. A separate
Node.js application ("Terminal") will call this service over the network
and is responsible for all UI, RBAC, payments, pricing, passenger data,
cargo, finance reporting, and printing.

The full behavioral contract — database schema, exact algorithms, API
shapes, event payloads, error semantics, idempotency rules, auth, and
test scenarios — is in the rest of this document (Sections 1 through 12).
You MUST follow it exactly. Any deviation will cause data corruption in
the existing production system.

TECH STACK (required)
---------------------
- Language: Rust (stable, 2021 edition)
- HTTP framework: axum 0.7+
- Async runtime: tokio (multi-thread, full features)
- Database: sqlx 0.8+ with PostgreSQL driver, compile-time checked queries
- Serialization: serde + serde_json
- UUID: uuid crate, v4
- Time: chrono with serde feature
- Redis: redis crate (for pub/sub of inventory events)
- HMAC: hmac + sha2
- Config: figment or envy (read from env vars)
- Tracing: tracing + tracing-subscriber
- Migrations: sqlx migrate (SQL files under ./migrations)

PROJECT LAYOUT
--------------
reservation-engine/
  Cargo.toml
  migrations/
    0001_seat_inventory.sql
    0002_seat_holds.sql
    0003_indexes.sql
  src/
    main.rs              # bootstrap, axum server, graceful shutdown
    config.rs            # env loading & validation
    error.rs             # AppError enum, IntoResponse impl
    auth.rs              # HMAC verification middleware
    idempotency.rs       # in-memory LRU + redis backup
    db.rs                # PgPool setup
    events.rs            # redis pub/sub publisher
    handlers/
      mod.rs
      holds.rs           # POST /holds, DELETE /holds/:hold_ref
      bookings.rs        # POST /bookings/confirm, POST /bookings/cancel
      inventory.rs       # GET /inventory/:trip_id
      health.rs          # GET /health
    services/
      mod.rs
      atomic_hold.rs     # the core SELECT FOR UPDATE algorithm
      release.rs
      confirm.rs
      cancel.rs
      reaper.rs          # background TTL expiration loop
    domain/
      mod.rs
      seat_inventory.rs  # row struct
      seat_hold.rs       # row struct
      ttl.rs             # TtlClass enum, durations
  tests/
    parity.rs            # integration tests from Section 10 checklist

ENV VARS THE SERVICE READS
--------------------------
DATABASE_URL                       (required, postgres://...)
REDIS_URL                          (required, redis://...)
RESERVATION_ENGINE_HMAC_SECRET     (required, >=32 bytes)
PORT                               (default 7000)
REAPER_INTERVAL_SECONDS            (default 60)
IDEMPOTENCY_TTL_SECONDS            (default 86400)
RUST_LOG                           (default info)

HOW TO BUILD
------------
1. Read this entire document FIRST. Do not start coding before you finish.
2. Create the directory structure exactly as shown above.
3. Write Cargo.toml with all dependencies pinned to a recent stable version.
4. Write the 3 migration files using the SQL schema in Section 1. Use
   IF NOT EXISTS guards so the migrations are safe to run against the
   shared TransityTerminal database (the tables already exist there).
5. Implement domain structs in src/domain/ matching Section 1 column names
   exactly (snake_case in DB, snake_case in Rust).
6. Implement services in src/services/ following the algorithms in Section 3.
   Every state-changing service MUST run inside a single sqlx transaction
   and use SELECT ... FOR UPDATE on seat_inventory rows.
7. Implement HMAC auth middleware per Section 7.
8. Implement idempotency cache per Section 6.
9. Implement HTTP handlers per Section 4 (engine API).
10. Implement the reaper background task per Section 3.5, using
    pg_try_advisory_lock for multi-instance safety.
11. Implement the Redis publisher for the two event types in Section 5.
12. Write integration tests covering EVERY scenario in Section 10.
13. Provide a README with: how to run locally, how to run tests, how to
    point Terminal at this service.

NON-NEGOTIABLE RULES
--------------------
- Never modify any column or table not listed in Section 8.
- Hold TTLs MUST be exactly 300 seconds (short) and 1800 seconds (long).
- conflict_seats in error responses MUST be a single-element array
  containing seat_no (matches existing Node behavior).
- For release operations, publish inventory.updated BEFORE holds.released.
- All write endpoints require Idempotency-Key header. Return 409 on
  conflicting bodies, return cached response on identical replays.
- Never log HMAC secret, full DATABASE_URL, or any seat passenger data.
- The service must shut down cleanly on SIGTERM (drain in-flight requests,
  stop reaper, close pool).

DELIVERABLE
-----------
A running Rust binary that:
- starts on PORT
- responds 200 on /health
- exposes the endpoints defined in Section 4
- publishes events to Redis channel "reservation.events"
- runs the reaper every REAPER_INTERVAL_SECONDS
- passes 100% of the parity tests in Section 10

Do not invent additional endpoints. Do not add features not described
in this document. Ask clarifying questions only if a section is
ambiguous; otherwise follow the spec literally.

END AGENT PROMPT >>>
```

After pasting the prompt above, also paste Sections 1 through 12 below into
the same Agent message (or commit this whole file into the new repo and tell
the Agent to read it).

---

## Section 1 — Domain Model (PostgreSQL Schema)

### 1.1 `seat_inventory`
The source of truth for the status of every seat on every leg of every trip.

| Column | Type | Constraint | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `trip_id` | uuid | NOT NULL, FK → `trips.id` | |
| `seat_no` | text | NOT NULL | e.g. "1A", "2B" |
| `leg_index` | integer | NOT NULL | 0-based, ordered by `trip_stop_times` |
| `booked` | boolean | default `false` | `true` if permanently booked |
| `hold_ref` | text | nullable | UUID of an active hold, if any |

**Required indexes:**
- `uniq_seat_inv_trip_seat_leg` UNIQUE on `(trip_id, seat_no, leg_index)`
- `idx_seat_inv_trip_seat` on `(trip_id, seat_no)`
- `idx_seat_inv_trip_id` on `(trip_id)`
- `idx_seat_inv_trip_leg` on `(trip_id, leg_index)`

**Invariants:**
- One row per `(trip_id, seat_no, leg_index)` tuple.
- If `booked = true`, then `hold_ref` MUST be NULL.
- If `hold_ref` is NOT NULL, then `booked` MUST be false.
- When a trip is materialized, every inventory row is created with
  `booked=false, hold_ref=NULL`.

---

### 1.2 `seat_holds`
Temporary, TTL-based seat reservations.

| Column | Type | Constraint | Notes |
|---|---|---|---|
| `id` | uuid | PK | |
| `hold_ref` | text | NOT NULL, UNIQUE | UUID v4; backreferenced by `seat_inventory.hold_ref` |
| `trip_id` | uuid | NOT NULL, FK → `trips.id` | |
| `seat_no` | text | NOT NULL | |
| `leg_indexes` | integer[] | NOT NULL | All legs this hold covers |
| `ttl_class` | text | NOT NULL | `'short'` or `'long'` |
| `operator_id` | text | NOT NULL | ID of the cashier/user that created the hold |
| `booking_id` | text | nullable | Set when hold is promoted to a booking |
| `expires_at` | timestamptz | NOT NULL | Absolute expiration time |
| `created_at` | timestamptz | default `now()` | |

**Required indexes:**
- `idx_seat_holds_trip_id` on `(trip_id)`
- `idx_seat_holds_expires_at` on `(expires_at)`
- `idx_seat_holds_active` on `(trip_id, expires_at) WHERE booking_id IS NULL` (partial)
- `idx_seat_holds_booking_id` on `(booking_id) WHERE booking_id IS NOT NULL`
- `idx_seat_holds_trip_seat` on `(trip_id, seat_no)`

**TTL durations (MUST match exactly):**
- `ttl_class = 'short'` → **300 seconds** (5 min) — used for seat-map selection
- `ttl_class = 'long'` → **1800 seconds** (30 min) — used for pending bookings

---

### 1.3 `bookings` (header)
Booking transaction header. The reservation engine **only cares** about these
columns:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `booking_code` | text | UNIQUE, format e.g. `BK-XXXXXX` |
| `status` | enum `booking_status` | see Section 2 |
| `trip_id` | uuid | FK |
| `origin_seq` | integer | origin stop sequence |
| `destination_seq` | integer | destination stop sequence |
| `pending_expires_at` | timestamptz nullable | required when `status='pending'` |
| `idempotency_key` | text | UNIQUE partial — prevents double-submit |

> All other columns (totals, discount, promo, channel, outlet, snapshots,
> passengers) remain owned by the Node Terminal layer. The reservation
> engine MUST NOT touch them.

---

## Section 2 — Enums (PostgreSQL)

```sql
CREATE TYPE booking_status AS ENUM
  ('pending', 'confirmed', 'checked_in', 'paid', 'cancelled', 'refunded', 'unseated');

CREATE TYPE ticket_status AS ENUM
  ('active', 'cancelled', 'refunded', 'checked_in', 'no_show', 'unseated');

CREATE TYPE trip_status AS ENUM
  ('scheduled', 'cancelled', 'closed');
```

The reservation engine is **only allowed** to perform these transitions:
- `bookings.status`: `pending → confirmed`, `pending → cancelled`, `confirmed → cancelled`
- `seat_inventory`: `(free) → (held) → (booked) → (free)`

---

## Section 3 — Engine Operations (functional contract)

### 3.1 `atomic_hold(request) → AtomicHoldResult`

**Input:**
```rust
struct SeatHoldRequest {
    trip_id: Uuid,
    seat_no: String,
    leg_indexes: Vec<i32>,  // ordered, all legs from origin to destination
    operator_id: String,
    ttl_class: TtlClass,    // Short | Long
}
```

**Output:**
```rust
enum AtomicHoldResult {
    Success { hold_ref: Uuid, expires_at: DateTime<Utc> },
    Failure { reason: HoldFailureReason, conflict_seats: Vec<String> },
}

enum HoldFailureReason {
    IncompleteInventory, // row count != leg_indexes.len()
    SeatConflict,        // already booked or held
    TransactionError,    // exception/DB error
}
```

**Required algorithm (transactional):**

```sql
BEGIN;

-- 1. Lock inventory rows (row-level, blocking)
SELECT * FROM seat_inventory
 WHERE trip_id = $1 AND seat_no = $2 AND leg_index = ANY($3)
   FOR UPDATE;

-- 2. Validate:
--    a. count(rows) == length(leg_indexes) → else INCOMPLETE_INVENTORY
--    b. every row has booked=false AND hold_ref IS NULL → else SEAT_CONFLICT

-- 3. Generate hold_ref = UUID v4
-- 4. expires_at = now() + (300s short | 1800s long)

-- 5. Mark inventory:
UPDATE seat_inventory SET hold_ref = $hold_ref
 WHERE trip_id = $1 AND seat_no = $2 AND leg_index = ANY($3);

-- 6. Insert seat_holds:
INSERT INTO seat_holds
  (hold_ref, trip_id, seat_no, leg_indexes, ttl_class, operator_id, expires_at)
VALUES (...);

COMMIT;
```

**Side effect after successful commit:**
- Publish `inventory.updated` event to Redis pub/sub channel
  `reservation.events`:
  ```json
  { "type": "inventory.updated",
    "trip_id": "...", "seat_no": "1A", "leg_indexes": [0,1,2],
    "ts": "..." }
  ```

---

### 3.2 `release_hold_by_ref(hold_ref) → { success: bool }`

**Algorithm:**
```sql
BEGIN;
  SELECT * FROM seat_holds WHERE hold_ref = $1;  -- if missing, return {success:false}

  UPDATE seat_inventory SET hold_ref = NULL WHERE hold_ref = $1;
  DELETE FROM seat_holds WHERE hold_ref = $1;
COMMIT;
```

**Events after commit (in this order):**
1. `inventory.updated` (trip_id, seat_no, leg_indexes)
2. `holds.released` (trip_id, [seat_no])

---

### 3.3 `confirm_booking(hold_ref, booking_id) → { success, conflict? }`

Promotes a hold to a permanent booking.

**Algorithm:**
```sql
BEGIN;
  -- 1. Verify hold exists and not expired
  SELECT * FROM seat_holds
   WHERE hold_ref = $1 AND expires_at > now()
     FOR UPDATE;
  -- if missing → return Failure(HoldExpiredOrMissing)

  -- 2. Lock the inventory rows held by this hold
  SELECT * FROM seat_inventory WHERE hold_ref = $1 FOR UPDATE;

  -- 3. Set booked=true, hold_ref=NULL
  UPDATE seat_inventory SET booked = true, hold_ref = NULL WHERE hold_ref = $1;

  -- 4. Mark hold as consumed
  UPDATE seat_holds SET booking_id = $2 WHERE hold_ref = $1;
COMMIT;
```

**Event:** `inventory.updated` per confirmed seat.

---

### 3.4 `cancel_booking_seats(trip_id, seat_no, leg_indexes) → { success }`

Called when a passenger is cancelled (matches the existing
`bookings.routes.ts` lines 134–180).

```sql
BEGIN;
  UPDATE seat_inventory
     SET booked = false, hold_ref = NULL
   WHERE trip_id = $1 AND seat_no = $2 AND leg_index = ANY($3);
COMMIT;
```

**Event:** `inventory.updated` per leg.

---

### 3.5 `expire_holds() → { released_count }`  (background reaper)

Run every **60 seconds** (matches the current Node scheduler cadence).

```sql
BEGIN;
  -- Use advisory lock so reaper doesn't double-run on multi-instance deploys
  SELECT pg_try_advisory_lock(hashtext('reservation_reaper'));

  WITH expired AS (
    SELECT hold_ref, trip_id, seat_no, leg_indexes
      FROM seat_holds
     WHERE expires_at <= now() AND booking_id IS NULL
     FOR UPDATE SKIP LOCKED
     LIMIT 500
  ),
  cleared AS (
    UPDATE seat_inventory SET hold_ref = NULL
     WHERE hold_ref IN (SELECT hold_ref FROM expired)
     RETURNING trip_id, seat_no, leg_index
  )
  DELETE FROM seat_holds WHERE hold_ref IN (SELECT hold_ref FROM expired);

  SELECT pg_advisory_unlock(hashtext('reservation_reaper'));
COMMIT;
```

**Event:** for each released seat, publish `holds.released`.

---

### 3.6 `get_inventory_snapshot(trip_id) → InventorySnapshot`

Read-only. Used by the seat-map UI.

**Output:**
```rust
struct InventorySnapshot {
    trip_id: Uuid,
    seats: Vec<SeatState>,
}
struct SeatState {
    seat_no: String,
    leg_states: Vec<LegState>,  // index = leg_index
}
struct LegState {
    leg_index: i32,
    status: SeatStatusKind,  // Free | Held | Booked
    hold_expires_at: Option<DateTime<Utc>>,
}
```

---

## Section 4 — HTTP API of the Engine

All write endpoints require:
- `Idempotency-Key: <opaque>` header
- HMAC headers from Section 7

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/holds` | `SeatHoldRequest` | `AtomicHoldResult` |
| DELETE | `/holds/:hold_ref` | — | `{ success: bool }` |
| POST | `/bookings/confirm` | `{ hold_ref, booking_id }` | `{ success, error? }` |
| POST | `/bookings/cancel` | `{ trip_id, seat_no, leg_indexes }` | `{ success }` |
| GET | `/inventory/:trip_id` | — | `InventorySnapshot` |
| GET | `/health` | — | `{ status: "ok" }` |

The Node Terminal app will continue to expose its existing public REST API
(`/api/holds`, `/api/bookings`, etc.) and will internally delegate to the
above engine endpoints.

---

## Section 5 — Real-time Event Schema (Redis Pub/Sub)

Channel: `reservation.events` (single channel, JSON messages).

```json
// inventory.updated
{
  "type": "inventory.updated",
  "trip_id": "uuid",
  "seat_no": "1A",
  "leg_indexes": [0, 1, 2],
  "ts": "2026-04-23T15:00:00Z"
}

// holds.released
{
  "type": "holds.released",
  "trip_id": "uuid",
  "seat_nos": ["1A", "2B"],
  "ts": "..."
}
```

The Node WebSocket server is the consumer; it re-broadcasts these events to
clients via Socket.io rooms named `trip:{trip_id}`.

---

## Section 6 — Idempotency

- Header: `Idempotency-Key: <opaque-string>`
- The engine stores `(idempotency_key) → (cached_response, body_hash, created_at)`
  for **24 hours** (in-memory LRU plus a Redis backup for multi-instance).
- If the same key arrives with the same body → return the cached response.
- If the same key arrives with a different body → return HTTP 409.
- Required on: `POST /holds`, `POST /bookings/confirm`, `POST /bookings/cancel`.

---

## Section 7 — Service-to-Service Authentication

- The engine is internal-only — never exposed publicly.
- Auth uses HMAC-SHA256 signatures.
- Required headers on every non-health request:
  - `X-Service-Id: terminal`
  - `X-Timestamp: <unix-seconds>`
  - `X-Signature: <hex>`
- Signature input string:
  ```
  {timestamp}.{method}.{path}.{sha256(body)}
  ```
- Reject if `|now - timestamp| > 30 seconds`.
- Secret comes from env var `RESERVATION_ENGINE_HMAC_SECRET`, rotatable.

---

## Section 8 — Database Connection

- Connect to the **same** PostgreSQL instance as TransityTerminal.
- The engine is allowed to **write** to:
  - `seat_inventory`
  - `seat_holds`
  - `bookings.status` and `bookings.pending_expires_at` columns only
- The engine is allowed to **read** from: `trips`, `trip_stop_times`
  (to validate `leg_index` ranges).
- Recommended: create a dedicated PG role `reservation_engine` with limited
  grants matching the above.
- Connection pool: min 10, max 50.

---

## Section 9 — Behavioral Details (must match exactly)

These are subtle behaviors the existing Node code relies on. Diverging from
them WILL cause hard-to-debug bugs in TransityTerminal.

1. **Hold conflict reporting**: `conflict_seats` returns `[seat_no]` (single-element
   array), not the list of conflicting legs. Reference: `atomicHold.service.ts:49,64`.
2. **Hold ref format**: lowercase UUID v4 string.
3. **Exact TTL**: 300s and 1800s. No drift.
4. **Leg validation**: `inventoryRows.length !== legIndexes.length` →
   `INCOMPLETE_INVENTORY`.
5. **Inventory clearing on cancel**: SET `booked=false, hold_ref=NULL` (both
   columns).
6. **Cascade cancel**: if EVERY passenger of a booking becomes `cancelled` or
   `unseated`, the booking header `status` becomes `cancelled`. Reference:
   `bookings.routes.ts:162-168`.
7. **WS event order on release**: emit `inventory.updated` FIRST, then
   `holds.released`. Reference: `atomicHold.service.ts:134-139`.

---

## Section 10 — Parity Test Checklist

The following integration tests must pass before the engine can be used as
the source of truth in production:

- [ ] Hold succeeds: 1 seat, 1 leg
- [ ] Hold succeeds: 1 seat, multiple legs
- [ ] Hold fails: seat already booked
- [ ] Hold fails: seat already held by another operator
- [ ] Hold fails: a leg_index does not exist in inventory
- [ ] Race: 2 concurrent holds for the same seat → exactly one succeeds, the
      other returns SEAT_CONFLICT
- [ ] Release a valid hold → inventory cleared, both events published
- [ ] Release a missing hold → `{success:false}`, no events
- [ ] Confirm a valid hold → booked=true, hold row marked with booking_id
- [ ] Confirm an expired hold → fail, no inventory change
- [ ] Reaper releases an expired hold within ≤1 minute
- [ ] Reaper does NOT release a hold whose booking_id is NOT NULL
- [ ] Cancel passenger: inventory freed; if it was the last passenger, the
      booking header becomes `cancelled`
- [ ] Idempotency: 2 hold requests with the same key → identical response,
      only one row in the DB
- [ ] Idempotency: 2 hold requests with the same key but different body → 409
- [ ] HMAC: missing or stale signature → 401
- [ ] Health endpoint returns 200 even when DB is down (or document otherwise)

---

## Section 11 — Reference Files in the Terminal Codebase

These files contain the existing Node implementation — read them when in
doubt:

- `shared/schema/inventory.ts` — schema for seat_inventory & seat_holds
- `shared/schema/booking.ts` — schema for bookings & passengers
- `shared/schema/enums.ts` — all PG enums
- `server/modules/bookings/atomicHold.service.ts` — reference hold/release impl
- `server/modules/bookings/bookings.service.ts` — booking creation flow
- `server/modules/bookings/bookings.routes.ts` — public REST API
- `server/scheduler.ts` — current reaper job (Node)
- `server/realtime/ws.ts` — WebSocket fanout
- `server/realtime/redis.ts` — Redis adapter

---

## Section 12 — Migration Strategy (Strangler Fig Pattern)

Roll the new engine out in stages to limit risk:

1. **Shadow mode** (2–3 weeks): the engine receives mirrored traffic from the
   Node endpoints; results are diffed but not used as truth.
2. **Canary at a single outlet**: one outlet uses the new engine as the source
   of truth.
3. **Cutover for hold + release**: all hold and release traffic flows through
   the engine.
4. **Cutover for confirm + cancel**: all state transitions flow through the
   engine.
5. **Cleanup**: remove `atomicHold.service.ts` from Node; the Node side becomes
   a thin proxy.
