# Pricing Identity-Swap & Legacy Removal Report

> **Historical record — not current architecture documentation.** This report
> documents the state of a refactor at the moment it was written. For the
> current pricing model, see `docs/FEATURES.md` §5. Some follow-up cleanup
> after this report is covered in `PRICING_LEGACY_CLEANUP_FINAL_REPORT.md`.

## 1. Complete Rename Map (old → new)

| Kind | Old | New |
|---|---|---|
| Table | `price_rules` (flat/per_leg: scope pattern\|trip\|leg\|time, tripId/legIndex/priority/rule) | `price_rules` (SAME NAME, OD-matrix shape: scope global\|pattern, patternId, matrix jsonb, kind regular\|seasonal, name, validFrom/validTo, isActive, updatedAt) |
| Table | *(new)* | `price_rule_exceptions` (per-trip, per-OD override) |
| Enum | `price_rule_scope` = `['pattern','trip','leg','time']` | `price_rule_scope` = `['global','pattern']` |
| Enum | *(new)* | `price_rule_kind` = `['regular','seasonal']` |
| Enum | `passenger_matrix_scope` / `passenger_matrix_kind` (temp names from the OD-matrix task) | removed — folded into `price_rule_scope`/`price_rule_kind` |
| Schema file | `shared/schema/pricing.ts` (`passengerPriceMatrices`, `passengerPriceExceptions`) | same file, exports `priceRules`, `priceRuleExceptions` |
| Schema file | `shared/schema/inventory.ts` (`priceRules` table lived here) | `priceRules` table removed from this file entirely (now solely in `pricing.ts`) |
| Migration | `migrations/0024_passenger_price_matrix.sql` | deleted |
| Migration | `migrations/0013_pricing.sql` (old flat/per_leg DDL) | overwritten with new create-only DDL for `price_rules`/`price_rule_exceptions` |
| Module dir | `server/modules/pricing/` (`pricing.service.ts`, `pricing.controller.ts`, `priceMatrix.*.ts`) | deleted — everything moved into `server/modules/priceRules/` |
| Resolver | `priceMatrix.resolver.ts` (`matrixSystemHasAnyData` legacy-fallback gate) | `priceRules.resolver.ts` — `matrixSystemHasAnyData` **removed entirely** (no legacy fallback left to gate) |
| Service | `PriceMatrixService` (`getPatternMatrixGrid`, `getGlobalMatrixList`, `saveMatrix`, `setMatrixActive`, `deleteMatrix`, `listMatrices`, `computeMatrixSyncStatus`) | `PriceRulesService` (`getPatternPriceGrid`, `getGlobalPriceList`, `savePriceRule`, `setPriceRuleActive`, `deletePriceRule`, `listPriceRules`, `computePriceSyncStatus`) — **also gained service-level `requirePermission(ctx,'master.price_rules')`** on every write method (defense-in-depth, matching this repo's Task #6 convention; the OD-matrix-task version only had route-level guards) |
| Service | `PricingService.quoteFare` — matrix-first, `legacyQuoteFare` fallback via `matrixSystemHasAnyData` | `PricingService.quoteFare` — resolver-only, **no fallback**, throws `NO_PRICE_RULE` on any 0 |
| Error | `StaleMatrixError` | `StalePriceRuleError` |
| Controller | `PriceMatrixController` | `PriceRulesController` |
| Routes fn | `registerPriceMatrixRoutes` (separate from old `registerPriceRulesRoutes`) | single `registerPriceRulesRoutes` (old CRUD routes replaced, not duplicated) |
| Route paths | `PUT/GET /api/pricing/matrix*` | `GET/PUT/PATCH/DELETE /api/price-rules*` (grid, seasonal, sync) |
| Route paths | old `POST /api/price-rules`, `PUT /api/price-rules/:id` (flat/per_leg CRUD) | removed — replaced by `PUT /api/price-rules` (whole-row upsert w/ optimistic lock) and `PATCH /api/price-rules/:id/active` |
| Route (unchanged) | `DELETE /api/price-rules/:id` | same path, now soft-deletes the OD-matrix row instead of a flat/per_leg row |
| Route (unchanged) | `GET /api/pricing/quote-fare` | unchanged path, now served from `server/modules/priceRules/pricing.controller.ts` |
| Client API | `passengerPriceMatrixApi` + old thin `priceRulesApi` (two objects) | single `priceRulesApi` (methods: `getPatternGrid`, `getGlobalList`, `savePriceRule`, `listSeasonalTemplates`, `createSeasonalTemplate`, `setPriceRuleActive`, `deletePriceRule`, `getSyncStatus`, `sync`, `listTripExceptions`, `upsertTripException`, `deleteTripException`) |
| Component | `client/src/components/masters/PassengerPriceMatrixManager.tsx` | overwrote `client/src/components/masters/PriceRulesManager.tsx` (old flat/per_leg admin form is gone) |
| Component | `client/src/components/masters/PriceMatrixGrid.tsx` (`PriceMatrixGrid`) | `client/src/components/masters/PriceGrid.tsx` (`PriceGrid`) |
| Menu / tabs | Two Master Data tabs: "Aturan Harga" (old CRUD) + "Harga OD-Matrix" (new) | single tab: **"Aturan Harga"** → `PriceRulesManager` |
| Sidebar | Two entries: "Price Rules" + "Harga OD-Matrix" | single entry: **"Price Rules"** → `/masters?tab=pricing` |
| In-page heading | "Harga Penumpang (OD-Matrix)" | "Harga Penumpang (OD)" |
| Storage (`IStorage`) | `getPriceRules`, `getPriceRulesForTrip`, `createPriceRule`, `updatePriceRule`, `deletePriceRule` | **removed** — all price-rule reads/writes now go through `PriceRulesService` directly against `db` (same pattern already used by `scheduler.service.ts` for schedule exceptions), not through the generic storage abstraction |

Function names kept as-is per the "grid/matrix-structure" exemption (they operate purely on the generic `{originStopId, destinationStopId}`-keyed blob and aren't the system's identity): `matrixCellKey`, `getMatrixCellPrice`, `extractMatrixGrid`, `serializeMatrixGrid`, and the types `MatrixGridRow`/`MatrixGridCell`/`MatrixStopLike`. These aren't table/class/module/route/menu names — they're the reusable grid-conversion internals cargo pricing will also call.

## 2. Files Deleted / Overwritten / Renamed

**Deleted:**
`migrations/0024_passenger_price_matrix.sql`, `server/modules/pricing/` (entire directory: `pricing.service.ts`, `pricing.controller.ts`, `priceMatrix.resolver.ts`, `priceMatrix.service.ts`, `priceMatrix.controller.ts`, `priceMatrix.routes.ts`), `client/src/components/masters/PassengerPriceMatrixManager.tsx`, `client/src/components/masters/PriceMatrixGrid.tsx`, `tests/priceMatrix.resolver.test.ts`, `PASSENGER_OD_MATRIX_REPORT.md` (superseded by this report).

**Overwritten (same path, old content replaced):**
`shared/schema/pricing.ts`, `shared/schema/enums.ts`, `shared/schema/inventory.ts` (old `priceRules` table removed), `shared/schema/relations.ts`, `migrations/0013_pricing.sql`, `server/modules/priceRules/priceRules.service.ts`, `server/modules/priceRules/priceRules.controller.ts`, `server/modules/priceRules/priceRules.routes.ts`, `client/src/components/masters/PriceRulesManager.tsx`, `server/seeds/05-prices.ts`, `server/seeds/nusa/05-prices.ts`, `server/seeds/buskita/05-prices.ts`.

**Renamed (new path):**
`server/modules/pricing/priceMatrix.resolver.ts` → `server/modules/priceRules/priceRules.resolver.ts`; `server/modules/pricing/pricing.service.ts`/`pricing.controller.ts` → `server/modules/priceRules/pricing.service.ts`/`pricing.controller.ts`; `client/src/components/masters/PriceMatrixGrid.tsx` → `PriceGrid.tsx`; `tests/priceMatrix.resolver.test.ts` → `tests/priceRules.resolver.test.ts`.

**Modified (logic changes, no rename):**
`server/modules/app/app.service.ts` (removed `priceRulesByPattern` legacy cache, the flat/per_leg fallback branch in `searchVirtualTrips`, dead code `getPatternFare`, `interface PriceRuleData`; fixed a stray dynamic-import path), `server/lib/scheduleSnapshot.ts` (removed `extractFareFromRule`, `legacyFarePerPerson`; `resolveFarePerPerson`/`resolveFaresForTrips` now resolver-only), `server/repositories/scheduling.repository.ts` (removed the 5 old CRUD methods; fixed the pattern-delete/trip-delete cleanup blocks to soft-delete `priceRuleExceptions` by `tripId` instead of `priceRules.scope='trip'`, which no longer exists; fixed `patternPriceRuleSet` query that referenced the now-nonexistent `priceRules.tripId` column), `server/storage.interface.ts` + `server/storage.ts` (removed the 5 delegating methods + now-unused type imports), `server/modules/bookings/booking.helpers.ts` + `roundTrip.service.ts` (import path update only), `tests/integration/rbac-endpoint-403.test.ts` (updated price-rules 403 cases to the new route surface; replaced a happy-path test that can't work anymore — see §7), `tests/sprint2-rbac-service-guards-extended.test.ts` (replaced `createPriceRule`/`updatePriceRule` test calls with `savePriceRule`/`deletePriceRule` against the actual new API, using the file's existing chainable `db` mock).

## 3. Final `migrations/0013_pricing.sql` (create-only)

```sql
DO $$ BEGIN
  CREATE TYPE "price_rule_scope" AS ENUM ('global', 'pattern');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "price_rule_kind" AS ENUM ('regular', 'seasonal');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "scope" "price_rule_scope" NOT NULL,
  "pattern_id" uuid REFERENCES "trip_patterns"("id"),
  "matrix" jsonb NOT NULL DEFAULT '{"version":1,"cells":{}}'::jsonb,
  "kind" "price_rule_kind" NOT NULL DEFAULT 'regular',
  "name" text, "valid_from" timestamptz, "valid_to" timestamptz,
  "is_active" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz DEFAULT now(), "deleted_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_price_rule_scope_pattern_kind_window"
  ON "price_rules" ("scope","pattern_id","kind","valid_from","valid_to") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_rules_pattern_id" ON "price_rules" ("pattern_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_rule_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "trip_id" uuid NOT NULL REFERENCES "trips"("id"),
  "origin_stop_id" uuid NOT NULL, "destination_stop_id" uuid NOT NULL,
  "price" numeric(12,2) NOT NULL,
  "updated_at" timestamptz DEFAULT now(), "created_at" timestamptz DEFAULT now(),
  "deleted_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_price_rule_exception_trip_od"
  ON "price_rule_exceptions" ("trip_id","origin_stop_id","destination_stop_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_rule_exception_trip_id" ON "price_rule_exceptions" ("trip_id");
```

## 4. DB Dev Instructions (Rendy — action needed on the VPS)

Your dev DB already has an OLD-shaped `price_rules` table (flat/per_leg columns) from before this refactor. `drizzle-kit push` diffs column-by-column and could try to awkwardly ALTER a table whose shape changed this much. Cleanest and safest for a dev-only DB:

```bash
psql "$DATABASE_URL" -c 'DROP TABLE IF EXISTS price_rules, price_rule_exceptions CASCADE;'
npm run db:push
```

Then re-run the seeds if you want the 8 sample routes priced again (`npm run seed` or whatever your seed entrypoint is — the 3 seed files were updated to insert directly into the new `price_rules` shape).

## 5. Legacy Verification — Final Grep (clean)

```
grep -rln "passenger_price_matrices|passengerPriceMatrices|PassengerPriceMatrix|passenger_matrix_|PriceMatrixService|PriceMatrixController|PassengerPriceMatrixManager|priceMatrix\b|passengerPriceMatrixApi|legacyQuoteFare|matrixSystemHasAnyData|0024_passenger_price_matrix|Harga OD-Matrix" server client shared migrations tests --include="*.ts" --include="*.tsx" --include="*.sql"
→ (no matches)
```
Also confirmed: no route registers `/matrix` anywhere (`grep "app\.\(get\|put\|post\|patch\|delete\).*matrix"` → no matches), no remaining `basePricePerLeg`/`per_leg` mode values anywhere in server/client (the one `pricingMode` field I'd left in the API response was removed — it was redundant with `source`/`ruleScope` and its only value would've been the constant `'od_matrix'`, itself a term worth avoiding).

**Deviation, disclosed**: `matrixId` (a request/response field naming a `price_rules` row id) and the private helper `getOrInitMatrixRow` were left as-is. These are internal/technical identifiers, not table/class/module/route/menu names or user-facing text, and the prompt's explicit final-grep ban list doesn't include them. Renaming them fully would touch several more call sites for no behavior change; flagging so it's a visible, deliberate choice rather than something missed.

## 6. Consumers Confirmed on the Shared Resolver (before/after)

**`pricing.service.ts` (CSO quote)** — before: matrix-first with `legacyQuoteFare` fallback gated by `matrixSystemHasAnyData`. After:
```ts
const resolved = await resolvePassengerCell({ patternId: trip.patternId, tripId, originStopId, destinationStopId, serviceDate });
if (resolved.price <= 0) throw new Error('NO_PRICE_RULE');
return { total: resolved.price, perPassenger: resolved.price, breakdown: {...} };
```
No fallback branch left at all.

**`app.service.ts` (`searchVirtualTrips`)** — before: resolver call + legacy flat/per_leg branch using a pre-fetched `priceRulesByPattern` map. After:
```ts
const resolved = await resolvePassengerCell({ patternId: base.patternId, originStopId: originPS.stopId, destinationStopId: destPS.stopId, serviceDate: params.date });
if (resolved.price > 0) fareQuote = resolved.price; // else stays 0 — "belum diset", no legacy substitute
```
The `priceRulesByPattern` raw-SQL prefetch and the whole flat/per_leg branch are gone.

**`scheduleSnapshot.ts` (`resolveFarePerPerson`/`resolveFaresForTrips`)** — before: resolver + `legacyFarePerPerson`/`extractFareFromRule` fallback reading `price_rules.rule` jsonb directly. After: both functions call `resolvePassengerCell` only; on any error or unresolvable stop times, they return `0`, never touching an old-shape column (which no longer exists).

All three call the exact same exported function (`resolvePassengerCell` in `priceRules.resolver.ts`), so identical `(patternId/tripId, originStopId, destinationStopId, serviceDate)` inputs give identical prices by construction.

## 7. `tsc` + Test Results

- `npx tsc --noEmit -p .` — **0 errors** in any pricing-related file (schema, resolver, service, controller, routes, app.service, scheduleSnapshot, scheduling.repository, storage, seeds, client components). Fixed 2 stray issues surfaced along the way: a leftover dynamic `import("../pricing/pricing.service")` in `app.service.ts`'s dead-ish `getBaseFare` helper, and a lingering `Set<string>` narrowing issue from an earlier session's unrelated dedup fix.
- `npx vitest run` — **229/233 passing**. The 4 remaining failures are in `tests/sprint2-reschedule-chaos.test.ts` and are **pre-existing and unrelated** (a `PermissionDeniedError` from `rbac.guard.ts` in `reschedule.service.ts`, a file untouched by this task — confirmed via `git diff`/`git log` showing no changes to that file in this session, and already flagged as pre-existing in the prior OD-matrix report).
- `tests/priceRules.resolver.test.ts` (renamed from `priceMatrix.resolver.test.ts`) — **17/17 passing**, unchanged assertions (precedence, JKT-BDG-JOG independent pricing, seasonal window, grid round-trip), just import-path/type-name updates.
- Updated 2 RBAC test files that referenced the old CRUD surface — both now passing (see §2 above for what changed and why).

## 8. Deviations From This Prompt

1. **`matrixId`/`getOrInitMatrixRow` not renamed** — see §5.
2. **Service-level RBAC guards added beyond what the prompt asked** — the prompt focused on the pricing-logic identity swap; I found `tests/sprint2-rbac-service-guards-extended.test.ts` already had (failing) expectations for `PriceRulesService` methods to take a `ctx: ServiceContext` and enforce `master.price_rules` at the service layer (matching this repo's established "Task #6" defense-in-depth convention used by every other service). I added this to all 7 write methods rather than leave that test permanently broken — a small scope addition, not asked for verbatim but necessary to avoid shipping a regression against an existing convention.
3. **One old happy-path RBAC test removed, not adapted** (`tests/integration/rbac-endpoint-403.test.ts`'s "POST /api/price-rules → 2xx + body rule baru") — it asserted `storage.createPriceRule` was called, but the new architecture's write path goes straight to `db` (same pattern as `scheduler.service.ts`), never touching the mocked `storage` object this suite fakes. Replaced with a comment explaining why; the 403/401 preHandler checks in the same describe block still fully cover the RBAC-gating concern since `requireFlag` rejects before the handler (and its `db` calls) ever runs.
4. **`migrations/meta/_journal.json`/`0020_snapshot.json` left untouched** — this repo's live-apply path is `npm run db:push` (`drizzle-kit push`, schema-diff against the live DB), confirmed from `drizzle.config.ts`/`package.json`; it does not read the migrations folder or its meta/journal at all (that's only relevant to `drizzle-kit migrate`, which this repo doesn't use). Reconciling the snapshot JSON would be cosmetic-only busywork with no functional effect on how you actually apply schema changes.

## 9. Manual QA Checklist

- [ ] Open Master Data → **"Aturan Harga"** tab (single tab now — no separate "Harga OD-Matrix" entry in the sidebar or the tab list).
- [ ] Pick a 3-city pattern, fill the grid (e.g. JKT-BDG 95k / BDG-JOG 100k / JKT-JOG 200k), Simpan Harga — reload and confirm values persisted.
- [ ] Save again after someone else's concurrent edit (or just resubmit with a stale `expectedUpdatedAt`) → expect a 409 + "data sudah berubah" toast, not a silent overwrite.
- [ ] CSO quote for each of the 3 OD pairs above matches exactly what was entered (not summed/derived).
- [ ] Create a seasonal template, verify it only affects quotes whose service date falls in its window.
- [ ] Add a trip exception for one trip+OD, confirm it overrides both seasonal and regular for that trip only.
- [ ] Edit a pattern's stops, reopen the grid, confirm the sync alert + "Sync" button still work (missing pairs added at 0, filled cells untouched).
- [ ] A trip with at least one priced OD stays selectable in CSO trip list even if another OD on it is unpriced (OD-aware selectability, unchanged from the OD-matrix task).
- [ ] Confirm `DELETE /api/price-rules/:id` still soft-deletes correctly (used by "hapus" actions in the UI, if any are wired).
