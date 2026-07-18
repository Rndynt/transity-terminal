# Server Dead-Code Tooling & Verified Cleanup

Scope: `server/` only (per task). No `client/`, `shared/`, or dependency
removals. Tooling installed: ESLint 10 (flat config) +
`eslint-plugin-unused-imports`, `knip` (v5.88.1 — see note below), `ts-prune`,
plus `depcheck` (ad hoc, informational only).

## Tooling notes

- **knip**: the latest 6.x pulls in `oxc-parser`'s native "raw transfer"
  mode, which crashed with `RangeError: Array buffer allocation failed` in
  this environment (a large fixed-size native buffer allocation, unrelated
  to this repo's code). Pinned to **knip@5.88.1**, which uses the
  TypeScript compiler API instead and works fine. Documented here so a
  future `npm update` doesn't silently reintroduce the crash.
- `knip.json` entries: `server/seeds/index.ts`, `server/seeds/perfload/{index,fix-holds}.ts`,
  `scripts/db-migrate.ts`, `scripts/add-missing-columns.ts` — the real
  standalone entry points (verified via `package.json` scripts + each
  file's own direct-invocation guard), not just `server/index.ts`.
- ESLint config: `unused-imports/no-unused-imports` + `unused-imports/no-unused-vars`
  as errors (`varsIgnorePattern`/`argsIgnorePattern`/`caughtErrorsIgnorePattern: '^_'`),
  base `no-unused-vars` off. Scoped to `server/**/*.ts` only.

## Step 2 — raw before/after

### ESLint (`npm run lint:server`)
- **Before**: 59 problems (42 auto-fixable via `--fix`, 17 needing manual judgment).
- **After**: 0 problems.

### knip (`npm run deadcode:server`)
- **Before**: 32 unused files, 33 unused exports, 24 unused deps (informational).
- **After**: 20 unused files (**all false positives**, see below), 16 unused
  exports (**all left in place on purpose**, see below), 24 unused deps
  (unchanged, informational/out of scope).

### ts-prune (`npm run unused-exports:server`)
100 lines total; cross-referenced against knip's export list (see below).
Full raw output not reproduced here — see `/tmp` if re-running, or re-run
`npm run unused-exports:server`.

### depcheck (informational, not acted on)
Unused: `autoprefixer`, `husky`, `lint-staged`, `pino-pretty`, `postcss`.
"Missing dependencies" output is all noise — TS path aliases (`@modules/*`,
`@server/*`) that depcheck doesn't understand aren't real npm packages.

---

## Step 3 — verified cleanup performed

### A. ESLint-flagged (unused imports/vars) — all fixed
Auto-fixed 42 unused imports across ~20 files (see `git diff --stat`).
Manually fixed 17 that needed judgment — **grep evidence for each**:

| File | Symbol | Fix | Evidence |
|---|---|---|---|
| `server/modules/auth/auth.routes.ts` | `err` (×5 catch bindings) | Removed binding (`catch {}`) | Read each catch body; none referenced `err`. One `catch (err: unknown)` at line 193 that DOES use `err` was left untouched (not flagged, not touched). |
| `server/modules/app/app.service.ts` | `UserBookingSummary` (interface) | Deleted | Not exported; 14-field interface with zero references anywhere in the file. |
| `server/modules/bookings/unseat.service.ts` | `previousStatus` | Deleted | Assigned from `booking.status`, never read; `bookingHistory.details` (checked) doesn't record a status transition at all. |
| `server/modules/priceRules/pricing.service.ts` | `seatClass` (param) | Renamed to `_seatClass` + comment | Grepped all `quoteFare(` call sites (4) — none pass a 4th arg. Kept (not deleted) as a documented placeholder: ties into the "no seat-class pricing dimension" gap noted in `PASSENGER_RESERVATION_AUDIT.md` §11. |
| `server/modules/tripStopTimes/tripStopTimes.controller.ts` | `tripId` (param) | Removed param + updated the one call site | Private method, exactly one caller in the same file; both updated together. |
| `server/modules/trips/trips.routes.ts` | `tripLegsController` (local + import) | Removed | See Unused Files §B — the whole controller it instantiates is dead. |
| `server/repositories/reports.repository.ts` | `ACTIVE_TICKET_SQL` | Deleted | Not exported, zero references anywhere in the file or repo. |
| `server/repositories/scheduling.repository.ts` | `cap` (in `getTripsForDateRange`) | **Renamed to `_cap`, NOT wired in — see bug note below** | — |
| `server/seeds/{root,nusa,buskita}/04-patterns.ts` | `s = ctx.stops` (×3, in `seedPatterns` only) | Deleted (one line each) | `seedPatterns` never references `s.*`; the *other* function in the same file, `seedPatternStops`, has its own separate `s` declaration that IS used — confirmed these are two different functions, not a false-positive shadow. |
| `server/seeds/perfload/index.ts` | `isPast` (first loop, line 432) | Deleted | That loop hardcodes `status: "scheduled"` regardless of `isPast`; a *second*, later loop (line 534) has its own separate `isPast` that IS used for booking status. Confirmed via function/loop boundaries, not a blind rename. |

**Bug found via lint tooling, deliberately NOT auto-fixed**: `scheduling.repository.ts`'s
`getTripsForDateRange()` computes a `cap` (with a comment claiming "same cap
policy as getTrips") but never applies `.limit(cap)` to the query — unlike
`getTrips()`, which does. The method (called by `SchedulerService`) currently
returns an **unbounded** result set for its date range. Fixing this changes
runtime behavior (adds a limit that wasn't being enforced), which is out of
this cleanup task's declared scope ("no runtime behavior change"). Renamed
to `_cap` only to satisfy the linter, with a comment explaining why it's
intentionally left unwired. **Recommend a dedicated follow-up to actually
apply `.limit(_cap)` here.**

### B. Unused files — knip + ts-prune + manual grep, all three agreeing

| File | Verdict | Evidence |
|---|---|---|
| `server/modules/tripLegs/tripLegs.controller.ts` (whole file) | **Deleted** | knip: unused file. ts-prune: its only export (`TripLegsController`) unused. Manual grep across the entire repo: the only reference is its own `export class` line and one `new TripLegsController(storage)` in `trips.routes.ts` (now also removed) — no route ever calls it. `TripLegsService` (a *different* class, in a sibling file) is genuinely used elsewhere and was **not** touched. |
| `server/seeds/{01-stops..09-rbac,context}.ts` (10 files, root) | **Deleted** | knip: unused files. ts-prune: all exports unused. Manual grep: zero references anywhere in the repo — critically, `server/seeds/index.ts`'s loader only ever dynamically imports `` `${base}/01-stops` `` etc. where `base` is `./nusa` or `./buskita` — **never** the bare root path. These 10 files predate the nusa/buskita multi-tenant split (confirmed independently in `PASSENGER_RESERVATION_AUDIT.md`'s earlier session) and were never wired into anything. |

**Found, NOT deleted — false positive, important to document:**

`server/seeds/nusa/*.ts` and `server/seeds/buskita/*.ts` (20 files) are
flagged as "unused" by **both** knip and ts-prune, but this is a false
positive both tools share: `server/seeds/index.ts` loads them via
`` await import(`${base}/01-stops`) `` — a **template-string dynamic
import**, which neither tool's static analysis can resolve. Manual grep
of `seeds/index.ts` confirms real, live usage. Left completely untouched.
This is exactly the scenario the task's "manual grep as tie-breaker" rule
exists for.

`server/seeds/perfload/fix-holds.ts` — flagged as unused, but its own
header comment identifies it as an intentional one-off manual recovery
script ("jalankan ini satu kali setelah seeder v2 gagal di phase 9"), run
directly via `tsx`, not meant to be imported by anything. Added to
`knip.json`'s `entry` list instead of deleting.

### C. Unused exports — cross-tool disagreement, all left in place

Everything below was flagged as unused by knip. For each, ts-prune either
disagreed (didn't flag it) or tagged it `(used in module)` — per the task's
rule, disagreement means **leave it, don't delete**:

| Export | Why left alone |
|---|---|
| `getHoldsAdapter` (`holds/holdsAdapter.ts`) | All 3 checks actually agree this is dead (confirmed independently during the passenger-reservation audit too) — but **`server/modules/holds/*` is explicitly excluded from this task's cleanup scope** ("active feature-flag dispatcher, not dead code"). Left untouched per that explicit instruction, flagged here for your own call. |
| `requireAnyPermission` (`rbac/rbac.guard.ts`) | ts-prune doesn't flag it at all (disagreement). |
| `bookingTotal`, `engineRequestDurationMs`, `refundTotal`, `webhookTotal` (`observability/metrics.ts`) | ts-prune doesn't flag any of them (disagreement) — plausible since Prometheus metric objects are typically used via `.inc()`/`.observe()` in ways static tools can miss. |
| `captureMessage` (`observability/sentry.ts`) | ts-prune tags it `(used in module)` — i.e. not actually dead. |
| `isRedisEnabled` (`realtime/redis.ts`) | ts-prune doesn't flag it (disagreement). |
| `emitToTrip`, `emitToBase`, `emitToCso`, `broadcast`, `emitTripStatusChanged`, `emitHoldsReleased`, `emitTripMaterialized`, `emitInventoryUpdated` (`realtime/ws.ts`) | ts-prune doesn't flag any of these (disagreement). Consistent with what's independently known: `emitInventoryUpdated` is called from `unseat.service.ts` — good sanity check that the disagreement rule is working as intended, not just noise. |

### D. `IStorage` methods
No `IStorage` methods were touched — none came up as unused in any of the
three tools' output.

### E. `shared/` — untouched
Not analyzed for deletion candidates (out of scope), per instruction.

### F. Documentation tidiness (Step 4) — skipped
Grepped for the 5 filenames first, as instructed. Found real
cross-references: the report files mention each other by name, and
`docs/terminal-readiness/00-TERMINAL-OVERVIEW.md` references
`fix/2026-04-20-comprehensive-hardening.md`'s current path directly. Since
this step was explicitly optional/low-risk and the instruction says to
skip if references would break, skipped the move entirely rather than do
a partial move or edit prose text that wasn't in scope.

---

## Verification

- `npm run check` (tsc): clean. Same 2 pre-existing, unrelated errors as
  the established baseline (`refunds.service.ts`, `realtime/ws.ts`)
  before and after this cleanup — confirmed via `git stash -u` against
  the pristine tree in earlier sessions; unaffected by this task.
- `npm test`: 243/247, same 4 pre-existing unrelated failures
  (`sprint2-reschedule-chaos.test.ts`) as established baseline. No new
  regressions.
- `npm run lint:server`: 0 errors (was 59).
- `console.routes.ts` was **not** split into controller/service, per
  explicit instruction (1 endpoint; noted as future tech debt only).

## Full list of files/exports/imports removed

**Deleted files (11):**
`server/modules/tripLegs/tripLegs.controller.ts`,
`server/seeds/01-stops.ts`, `02-layouts.ts`, `03-vehicles.ts`,
`04-patterns.ts`, `05-prices.ts`, `06-tripbases.ts`, `07-cargo.ts`,
`08-trips.ts`, `09-rbac.ts`, `context.ts`.

**Removed exports/locals (beyond auto-fixed imports):** `UserBookingSummary`
(interface), `previousStatus`, `tripLegsController` (local + import),
`ACTIVE_TICKET_SQL`, `s = ctx.stops` (×3, `seedPatterns` only), `isPast`
(first loop only), `_retryQueueSize`, `_clearRetryQueue`,
`runWithRequestContext`, `optionalAuthMiddleware`, `optionalAuth`,
`getEffectiveFlags`, `isSentryEnabled`, `SEARCH_LIMIT`,
`clampBookingsPageSize`, `clampListPageSize`, `formatTimeWithSecondsInTZ`,
`formatDateTimeInTZ`, `toZonedTimeSafe`, `getTimezoneOffset`,
`isValidTimeFormat`, `getCurrentTimeInTZ`, `getCurrentDateInTZ` (+ the
now-unused `dateFnsToZonedTime` import that only those last two consumed).

**Renamed, not deleted (documented placeholders / known gaps):** `seatClass`
→ `_seatClass` (pricing.service.ts, reserved for future seat-class
pricing), `cap` → `_cap` (scheduling.repository.ts, **flags a real
unbounded-query bug, not fixed here — see above**).
